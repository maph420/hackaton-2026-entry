import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import type { DocumentKind } from '@/components/roadmap/document-viewer'
import { RoadmapExplorer } from '@/components/roadmap/roadmap-explorer'
import { db } from '@/lib/db'
import {
  materialFiles,
  materials,
  practiceExercises,
  subjects,
  subtopics,
  topics,
} from '@/lib/db/schema'
import { requireUser } from '@/lib/session'

const FCEIA_FILE_KEY = /^fceia:(material|exam):\d+$/

export default async function RoadmapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()

  const [subject] = await db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.id, id), eq(subjects.userId, user.id)))
  if (!subject) notFound()

  const [topicRows, subtopicRows, exerciseRows, materialRows] = await Promise.all([
    db
      .select({
        id: topics.id,
        title: topics.title,
        summary: topics.summary,
        position: topics.position,
        prerequisites: topics.prerequisites,
        status: topics.status,
      })
      .from(topics)
      .where(and(eq(topics.subjectId, id), eq(topics.userId, user.id)))
      .orderBy(asc(topics.position)),
    db
      .select({
        id: subtopics.id,
        topicId: subtopics.topicId,
        title: subtopics.title,
        position: subtopics.position,
        status: subtopics.status,
        sources: subtopics.sources,
      })
      .from(subtopics)
      .where(and(eq(subtopics.subjectId, id), eq(subtopics.userId, user.id)))
      .orderBy(asc(subtopics.position)),
    db
      .select({
        id: practiceExercises.id,
        topicId: practiceExercises.topicId,
        subtopicId: practiceExercises.subtopicId,
        statement: practiceExercises.statement,
        done: practiceExercises.done,
      })
      .from(practiceExercises)
      .where(and(eq(practiceExercises.subjectId, id), eq(practiceExercises.userId, user.id)))
      .orderBy(asc(practiceExercises.position)),
    db
      .select({
        id: materials.id,
        externalKey: materials.externalKey,
        mimeType: materialFiles.mimeType,
      })
      .from(materials)
      .leftJoin(materialFiles, eq(materialFiles.materialId, materials.id))
      .where(and(eq(materials.subjectId, id), eq(materials.userId, user.id))),
  ])

  if (topicRows.length === 0) redirect(`/materias/${id}`)

  const documents: Record<string, DocumentKind> = {}
  for (const row of materialRows) {
    if (row.mimeType) {
      documents[row.id] = row.mimeType.startsWith('image/') ? 'image' : 'pdf'
    } else if (row.externalKey && FCEIA_FILE_KEY.test(row.externalKey)) {
      documents[row.id] = 'pdf'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={`/materias/${id}`}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {subject.name}
        </Link>
        <h1 className="text-3xl font-semibold">Roadmap</h1>
      </div>
      <RoadmapExplorer
        subjectId={id}
        subjectName={subject.name}
        initialTopics={topicRows}
        initialSubtopics={subtopicRows}
        initialExercises={exerciseRows}
        documents={documents}
      />
    </div>
  )
}
