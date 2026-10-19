'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { UserError, toUserMessage } from '@/lib/errors'
import { db } from '@/lib/db'
import { chunks, materialFiles, materials, subjects } from '@/lib/db/schema'
import { saveMaterial } from '@/lib/ai/ingest'
import { extractDocumentFromFile, imageMimeType } from '@/lib/ai/text'
import { getUserId } from '@/lib/session'
import { isMaterialKind } from '@/lib/types'

function viewableMimeType(file: File) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return 'application/pdf'
  }
  return imageMimeType(file)
}

export async function addMaterial(formData: FormData) {
  const userId = await getUserId()
  const subjectId = String(formData.get('subjectId') ?? '')
  const rawKind = String(formData.get('kind') ?? 'apunte')
  const kind = isMaterialKind(rawKind) ? rawKind : 'otro'
  const pastedText = String(formData.get('text') ?? '').trim()
  const file = formData.get('file')
  const hasFile = file instanceof File && file.size > 0

  let errorMessage: string | null = null

  try {
    const [subject] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, subjectId), eq(subjects.userId, userId)))
    if (!subject) throw new UserError('Materia no encontrada.')

    const document = hasFile
      ? await extractDocumentFromFile(file)
      : { text: pastedText, pages: null }
    if (!document.text) {
      throw new UserError(
        'No pude extraer texto. Pegá el contenido o subí un PDF con texto seleccionable o una imagen legible.',
      )
    }

    const title =
      String(formData.get('title') ?? '').trim() ||
      (hasFile ? file.name.replace(/\.[^.]+$/, '') : 'Sin título')

    const materialId = await saveMaterial({
      userId,
      subjectId,
      title,
      kind,
      text: document.text,
      pages: document.pages,
      sourceName: hasFile ? file.name : null,
    })
    if (!materialId) throw new UserError('El material es demasiado corto para indexarlo.')

    const mimeType = hasFile ? viewableMimeType(file) : null
    if (hasFile && mimeType) {
      await db.insert(materialFiles).values({
        materialId,
        userId,
        mimeType,
        fileName: file.name,
        data: Buffer.from(await file.arrayBuffer()),
      })
    }
  } catch (error) {
    errorMessage = toUserMessage(error, 'No pude indexar el material. Intentá de nuevo.')
  }

  revalidatePath(`/materias/${subjectId}`)
  if (errorMessage) {
    redirect(`/materias/${subjectId}?error=${encodeURIComponent(errorMessage)}`)
  }
  redirect(`/materias/${subjectId}`)
}

export async function deleteMaterial(formData: FormData) {
  const userId = await getUserId()
  const materialId = String(formData.get('materialId') ?? '')
  const subjectId = String(formData.get('subjectId') ?? '')

  await db.transaction(async (tx) => {
    await tx
      .delete(chunks)
      .where(and(eq(chunks.materialId, materialId), eq(chunks.userId, userId)))
    await tx
      .delete(materialFiles)
      .where(and(eq(materialFiles.materialId, materialId), eq(materialFiles.userId, userId)))
    await tx
      .delete(materials)
      .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
  })

  revalidatePath(`/materias/${subjectId}`)
}
