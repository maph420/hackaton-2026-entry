import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { chunks, materials } from '@/lib/db/schema'
import { embedTexts } from '@/lib/ai/retrieve'
import { chunkPages, chunkText, type PageChunk } from '@/lib/ai/text'
import type { MaterialKind } from '@/lib/types'

const INSERT_SLICE = 200

export type NewMaterial = {
  userId: string
  subjectId: string
  title: string
  kind: MaterialKind
  text: string
  pages: string[] | null
  sourceName: string | null
  externalKey?: string | null
  /** Re-indexes an existing document in place, so references to its id keep working. */
  replaceMaterialId?: string
}

/** Indexes a document with its page numbers. Returns its id, or null when there is not enough text. */
export async function saveMaterial(input: NewMaterial): Promise<string | null> {
  const pieces: PageChunk[] = input.pages
    ? chunkPages(input.pages)
    : chunkText(input.text).map((content) => ({ content, page: null }))
  if (pieces.length === 0) return null

  const embeddings = await embedTexts(pieces.map((piece) => piece.content))

  return db.transaction(async (tx) => {
    let materialId: string

    if (input.replaceMaterialId) {
      materialId = input.replaceMaterialId
      await tx
        .delete(chunks)
        .where(and(eq(chunks.materialId, materialId), eq(chunks.userId, input.userId)))
      await tx
        .update(materials)
        .set({ content: input.text, chunkCount: pieces.length, pagesChecked: true })
        .where(and(eq(materials.id, materialId), eq(materials.userId, input.userId)))
    } else {
      const [material] = await tx
        .insert(materials)
        .values({
          userId: input.userId,
          subjectId: input.subjectId,
          title: input.title.slice(0, 160),
          kind: input.kind,
          content: input.text,
          sourceName: input.sourceName,
          externalKey: input.externalKey ?? null,
          chunkCount: pieces.length,
          pagesChecked: true,
        })
        .returning({ id: materials.id })
      materialId = material.id
    }

    for (let start = 0; start < pieces.length; start += INSERT_SLICE) {
      await tx.insert(chunks).values(
        pieces.slice(start, start + INSERT_SLICE).map((piece, offset) => ({
          userId: input.userId,
          subjectId: input.subjectId,
          materialId,
          position: start + offset,
          page: piece.page,
          content: piece.content,
          embedding: embeddings[start + offset],
        })),
      )
    }
    return materialId
  })
}
