'use client'

import { BookOpen, Check } from 'lucide-react'
import { ExerciseRow } from '@/components/exercise-row'
import type { DocumentKind, ViewerDocument } from '@/components/roadmap/document-viewer'
import { MathText } from '@/components/math-text'
import { StatusControl } from '@/components/status-control'
import { formatPages } from '@/lib/format-pages'
import { missingPagesNote } from '@/lib/missing-pages'
import { stripMath } from '@/lib/math'
import {
  MATERIAL_KINDS,
  STATUS_LABELS,
  type ExerciseData,
  type ProgressStatus,
  type SubtopicData,
  type TopicData,
} from '@/lib/types'

type Neighbour = { id: string; title: string; status: ProgressStatus }

function NeighbourList({
  label,
  items,
  onSelect,
}: {
  label: string
  items: Neighbour[]
  onSelect: (topicId: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className="flex items-center gap-1 rounded-full border bg-secondary/60 px-2.5 py-1 text-xs transition-colors hover:border-primary/60"
            >
              {item.status === 'done' && (
                <Check className="size-3 text-primary" aria-label={STATUS_LABELS.done} />
              )}
              {stripMath(item.title)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function TopicPanel({
  topic,
  subtopics,
  exercises,
  requires,
  enables,
  onSelectTopic,
  onTopicStatus,
  onSubtopicStatus,
  onExerciseDone,
  documents,
  onOpenDocument,
}: {
  documents: Record<string, DocumentKind>
  onOpenDocument: (document: ViewerDocument) => void
  topic: TopicData
  subtopics: SubtopicData[]
  exercises: ExerciseData[]
  requires: Neighbour[]
  enables: Neighbour[]
  onSelectTopic: (topicId: string) => void
  onTopicStatus: (status: ProgressStatus) => void
  onSubtopicStatus: (subtopicId: string, status: ProgressStatus) => void
  onExerciseDone: (exerciseId: string, done: boolean) => void
}) {
  const subtopicById = new Map(subtopics.map((subtopic) => [subtopic.id, subtopic]))
  const unlocked = exercises.filter(
    (exercise) => subtopicById.get(exercise.subtopicId)?.status === 'done',
  )
  const lockedCount = exercises.length - unlocked.length

  return (
    <article aria-labelledby="topic-title" className="flex flex-col gap-5 rounded-xl border bg-card p-5">
      <header className="flex flex-col gap-3">
        <div>
          <h2
            id="topic-title"
            tabIndex={-1}
            className="font-serif text-xl font-semibold text-balance outline-none"
          >
            <MathText text={topic.title} />
          </h2>
          {topic.summary && (
            <p className="mt-1 text-sm text-muted-foreground">
              <MathText text={topic.summary} />
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Estado del tema</span>
          <StatusControl
            value={topic.status}
            label={`Estado del tema ${stripMath(topic.title)}`}
            onChange={onTopicStatus}
          />
        </div>
        <NeighbourList label="Antes conviene saber" items={requires} onSelect={onSelectTopic} />
        <NeighbourList label="Desbloquea" items={enables} onSelect={onSelectTopic} />
      </header>

      <section aria-labelledby="subtopics-title" className="flex flex-col gap-2 border-t pt-4">
        <h3 id="subtopics-title" className="text-sm font-semibold">
          Subtemas
        </h3>
        <ul className="flex flex-col gap-2">
          {subtopics.map((subtopic) => (
            <li key={subtopic.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 flex-1 text-sm font-medium">
                  <MathText text={subtopic.title} />
                </span>
                <StatusControl
                  value={subtopic.status}
                  label={`Estado de ${stripMath(subtopic.title)}`}
                  onChange={(status) => onSubtopicStatus(subtopic.id, status)}
                />
              </div>
              <details className="mt-2 text-xs">
                <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
                  Dónde estudiarlo ({subtopic.sources.length})
                </summary>
                {subtopic.sources.length === 0 ? (
                  <p className="mt-2 text-muted-foreground">
                    No encontré fragmentos relacionados en tu bibliografía.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {subtopic.sources.map((source) => (
                      <li key={source.materialId} className="rounded-md bg-secondary/60 p-2">
                        <p className="font-medium">
                          {source.materialTitle}
                          <span className="font-normal text-muted-foreground">
                            {' · '}
                            {MATERIAL_KINDS[source.materialKind as keyof typeof MATERIAL_KINDS] ??
                              'Material'}
                          </span>
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {source.pages && source.pages.length > 0
                            ? `Leé ${formatPages(source.pages)}`
                            : documents[source.materialId]
                              ? 'Sin numeración de páginas: abrilo y buscá el tema por su título.'
                              : missingPagesNote(source.materialKind)}
                        </p>
                        {documents[source.materialId] && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenDocument({
                                materialId: source.materialId,
                                title: source.materialTitle,
                                kind: documents[source.materialId],
                                pages: source.pages ?? null,
                              })
                            }
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 font-medium transition-colors hover:border-primary/60"
                          >
                            <BookOpen className="size-3.5" aria-hidden="true" />
                            {source.pages && source.pages.length > 0
                              ? `Abrir en la página ${source.pages[0]}`
                              : 'Ver documento'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="exercises-title" className="flex flex-col gap-2 border-t pt-4">
        <h3 id="exercises-title" className="text-sm font-semibold">
          Ejercicios de práctica
        </h3>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este tema todavía no tiene ejercicios. Subí una práctica a la biblioteca y volvé a
            generar el roadmap.
          </p>
        ) : (
          <>
            {unlocked.length > 0 && (
              <ul className="flex flex-col gap-2">
                {unlocked.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    context={subtopicById.get(exercise.subtopicId)?.title ?? topic.title}
                    onChange={(done) => onExerciseDone(exercise.id, done)}
                  />
                ))}
              </ul>
            )}
            {lockedCount > 0 && (
              <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                {unlocked.length === 0
                  ? `Hay ${lockedCount} ${lockedCount === 1 ? 'ejercicio' : 'ejercicios'} para este tema. `
                  : `${lockedCount} ${lockedCount === 1 ? 'ejercicio más' : 'ejercicios más'}. `}
                Se habilitan al marcar como visto el subtema al que corresponden.
              </p>
            )}
          </>
        )}
      </section>
    </article>
  )
}
