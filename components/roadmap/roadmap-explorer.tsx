'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ListChecks } from 'lucide-react'
import {
  DocumentViewer,
  type DocumentKind,
  type ViewerDocument,
} from '@/components/roadmap/document-viewer'
import { DownloadRoadmapButton } from '@/components/roadmap/download-roadmap-button'
import { RoadmapGraph } from '@/components/roadmap/roadmap-graph'
import { TopicPanel } from '@/components/roadmap/topic-panel'
import { Button } from '@/components/ui/button'
import { setExerciseDone, setSubtopicStatus, setTopicStatus } from '@/app/actions/roadmap'
import { layoutRoadmap } from '@/lib/roadmap/layout'
import { deriveTopicStatus } from '@/lib/roadmap/progress'
import type { ExerciseData, ProgressStatus, SubtopicData, TopicData } from '@/lib/types'

function pickInitialTopic(topics: TopicData[]) {
  const sorted = [...topics].sort((a, b) => a.position - b.position)
  const status = new Map(sorted.map((topic) => [topic.id, topic.status]))
  const ready = sorted.find(
    (topic) =>
      topic.status !== 'done' && topic.prerequisites.every((id) => status.get(id) === 'done'),
  )
  return (ready ?? sorted.find((topic) => topic.status !== 'done') ?? sorted[0])?.id ?? null
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span
          className="size-3 rounded-full border-[1.5px] border-muted-foreground/70"
          aria-hidden="true"
        />
        Por ver
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-chart-3" aria-hidden="true" />
        En curso
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-full bg-primary" aria-hidden="true" />
        Visto
      </li>
      <li className="flex items-center gap-1.5">
        <span
          className="h-3 w-5 rounded-sm border border-dashed border-muted-foreground"
          aria-hidden="true"
        />
        Con temas previos pendientes
      </li>
    </ul>
  )
}

function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'materia'
  )
}

export function RoadmapExplorer({
  subjectId,
  subjectName,
  initialTopics,
  initialSubtopics,
  initialExercises,
  documents,
}: {
  documents: Record<string, DocumentKind>
  subjectId: string
  subjectName: string
  initialTopics: TopicData[]
  initialSubtopics: SubtopicData[]
  initialExercises: ExerciseData[]
}) {
  const [topics, setTopics] = useState(initialTopics)
  const [subtopics, setSubtopics] = useState(initialSubtopics)
  const [exercises, setExercises] = useState(initialExercises)
  const [selectedId, setSelectedId] = useState(() => pickInitialTopic(initialTopics))
  const [error, setError] = useState<string | null>(null)
  const [viewerDocument, setViewerDocument] = useState<ViewerDocument | null>(null)
  const [, startTransition] = useTransition()

  const svgRef = useRef<SVGSVGElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => layoutRoadmap(initialTopics), [initialTopics])
  const topicById = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics])

  const counts = useMemo(() => {
    const result = new Map<string, { done: number; total: number }>()
    for (const subtopic of subtopics) {
      const current = result.get(subtopic.topicId) ?? { done: 0, total: 0 }
      current.total += 1
      if (subtopic.status === 'done') current.done += 1
      result.set(subtopic.topicId, current)
    }
    return result
  }, [subtopics])

  const doneSubtopics = subtopics.filter((subtopic) => subtopic.status === 'done').length
  const progress = subtopics.length === 0 ? 0 : Math.round((doneSubtopics / subtopics.length) * 100)

  const available = topics
    .filter(
      (topic) =>
        topic.status !== 'done' &&
        topic.prerequisites.every((id) => topicById.get(id)?.status === 'done'),
    )
    .sort((a, b) => a.position - b.position)

  const selected = selectedId ? topicById.get(selectedId) : undefined
  const selectedSubtopics = subtopics
    .filter((subtopic) => subtopic.topicId === selectedId)
    .sort((a, b) => a.position - b.position)
  const selectedExercises = exercises.filter((exercise) => exercise.topicId === selectedId)

  const persist = (run: () => Promise<unknown>, rollback: () => void) => {
    setError(null)
    startTransition(async () => {
      try {
        await run()
      } catch {
        rollback()
        setError('No se pudo guardar el cambio. Intentá de nuevo.')
      }
    })
  }

  const selectTopic = (topicId: string) => {
    setSelectedId(topicId)
    requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const { top } = panel.getBoundingClientRect()
      if (top < 0 || top > window.innerHeight * 0.4) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      panel.querySelector<HTMLElement>('#topic-title')?.focus({ preventScroll: true })
    })
  }

  const changeTopicStatus = (topicId: string, status: ProgressStatus) => {
    const previousTopics = topics
    const previousSubtopics = subtopics
    setTopics((current) =>
      current.map((topic) => (topic.id === topicId ? { ...topic, status } : topic)),
    )
    setSubtopics((current) =>
      current.map((subtopic) =>
        subtopic.topicId === topicId ? { ...subtopic, status } : subtopic,
      ),
    )
    persist(
      () => setTopicStatus(topicId, status),
      () => {
        setTopics(previousTopics)
        setSubtopics(previousSubtopics)
      },
    )
  }

  const changeSubtopicStatus = (subtopicId: string, status: ProgressStatus) => {
    const target = subtopics.find((subtopic) => subtopic.id === subtopicId)
    if (!target) return
    const previousTopics = topics
    const previousSubtopics = subtopics

    const nextSubtopics = subtopics.map((subtopic) =>
      subtopic.id === subtopicId ? { ...subtopic, status } : subtopic,
    )
    const topicStatus = deriveTopicStatus(
      nextSubtopics
        .filter((subtopic) => subtopic.topicId === target.topicId)
        .map((subtopic) => subtopic.status),
    )
    setSubtopics(nextSubtopics)
    setTopics((current) =>
      current.map((topic) =>
        topic.id === target.topicId ? { ...topic, status: topicStatus } : topic,
      ),
    )
    persist(
      () => setSubtopicStatus(subtopicId, status),
      () => {
        setTopics(previousTopics)
        setSubtopics(previousSubtopics)
      },
    )
  }

  const changeExerciseDone = (exerciseId: string, done: boolean) => {
    const previous = exercises
    setExercises((current) =>
      current.map((exercise) => (exercise.id === exerciseId ? { ...exercise, done } : exercise)),
    )
    persist(
      () => setExerciseDone(exerciseId, done),
      () => setExercises(previous),
    )
  }

  const neighbours = (ids: string[]) =>
    ids.flatMap((id) => {
      const topic = topicById.get(id)
      return topic ? [{ id: topic.id, title: topic.title, status: topic.status }] : []
    })

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Avance general"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-5"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-2">
          <p className="text-sm">
            <span className="font-semibold">{progress}%</span>
            <span className="text-muted-foreground">
              {' '}
              · {doneSubtopics} de {subtopics.length} subtemas vistos
            </span>
          </p>
          <div
            role="progressbar"
            aria-label="Avance general de la materia"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-secondary"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <Button
          nativeButton={false}
          variant="outline"
          render={<Link href={`/materias/${subjectId}/practica`} />}
        >
          <ListChecks aria-hidden="true" />
          Ir a la práctica
        </Button>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">
          {error}
        </p>
      )}

      {available.length > 0 && (
        <section aria-labelledby="available-title" className="flex flex-col gap-2">
          <h2 id="available-title" className="text-sm font-semibold">
            Podés estudiar ahora
          </h2>
          <ul className="flex flex-wrap gap-2">
            {available.slice(0, 8).map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => selectTopic(topic.id)}
                  className="rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/60"
                >
                  {topic.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_400px] 2xl:items-start">
        <section
          aria-labelledby="map-title"
          className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 2xl:sticky 2xl:top-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="map-title" className="text-sm font-semibold">
              Mapa de dependencias
            </h2>
            <DownloadRoadmapButton
              svgRef={svgRef}
              filename={`roadmap-${fileSlug(subjectName)}.png`}
            />
          </div>
          <Legend />
          <div className="max-h-[640px] overflow-auto rounded-lg border bg-background">
            <RoadmapGraph
              layout={layout}
              topics={topics}
              counts={counts}
              selectedId={selectedId}
              onSelect={selectTopic}
              svgRef={svgRef}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Las flechas van del tema que conviene saber primero al que lo necesita. Los temas en
            líneas distintas son independientes entre sí.
          </p>
          <details className="rounded-lg border bg-card px-4 py-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer text-sm font-medium text-foreground">
              ¿Cómo se decide qué tema depende de cuál?
            </summary>
            <div className="mt-3 flex flex-col gap-2 leading-relaxed">
              <p>
                Un tema B depende de A solo si, para entender las definiciones o demostraciones de B,
                o para resolver sus ejercicios típicos, hace falta usar algo que se introduce en A.
                La prueba es: si se pueden resolver los ejercicios de B sin haber estudiado A, no hay
                dependencia.
              </p>
              <p>
                No cuenta como dependencia que A aparezca antes en el programa, que sean del mismo
                capítulo o que A se use solo como ejemplo. Tampoco se marcan las indirectas: si C
                depende de B y B de A, la flecha de A a C no se dibuja salvo que C use A por sí
                mismo.
              </p>
              <p>
                Las dependencias las propone el modelo a partir del programa y se verifican sin ciclos.
                Si alguna no te cierra, podés estudiar el tema igual: el orden es una guía.
              </p>
            </div>
          </details>
        </section>

        <div ref={panelRef} className="scroll-mt-4">
          {selected && (
            <TopicPanel
              key={selected.id}
              topic={selected}
              subtopics={selectedSubtopics}
              exercises={selectedExercises}
              requires={neighbours(selected.prerequisites)}
              enables={neighbours(
                topics
                  .filter((topic) => topic.prerequisites.includes(selected.id))
                  .map((topic) => topic.id),
              )}
              onSelectTopic={selectTopic}
              onTopicStatus={(status) => changeTopicStatus(selected.id, status)}
              onSubtopicStatus={changeSubtopicStatus}
              onExerciseDone={changeExerciseDone}
              documents={documents}
              onOpenDocument={setViewerDocument}
            />
          )}
        </div>
      </div>
      <DocumentViewer document={viewerDocument} onClose={() => setViewerDocument(null)} />
    </div>
  )
}
