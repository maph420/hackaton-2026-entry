'use client'

import type { KeyboardEvent, RefObject } from 'react'
import { stripMath } from '@/lib/math'
import { NODE_H, NODE_W, type RoadmapLayout } from '@/lib/roadmap/layout'
import { STATUS_LABELS, type ProgressStatus, type TopicData } from '@/lib/types'
import { cn } from '@/lib/utils'

const TITLE_LINE_LENGTH = 25

const NODE_STYLES: Record<ProgressStatus, string> = {
  pending: 'fill-card stroke-border',
  learning: 'fill-accent stroke-primary/40',
  done: 'fill-secondary stroke-primary/60',
}

function wrapTitle(title: string, maxLines = 2) {
  const lines: string[] = []
  let current = ''
  for (const word of title.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word
    if (next.length > TITLE_LINE_LENGTH && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)

  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, TITLE_LINE_LENGTH - 1)}…`
  return kept
}

function StatusMark({ status }: { status: ProgressStatus }) {
  if (status === 'done') {
    return (
      <>
        <circle cx={18} cy={20} r={7} className="fill-primary" />
        <path
          d="M14.6 20.4 L17.2 23 L21.6 17.8"
          className="fill-none stroke-primary-foreground"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )
  }
  if (status === 'learning') {
    return <circle cx={18} cy={20} r={7} className="fill-chart-3 stroke-foreground/30" />
  }
  return <circle cx={18} cy={20} r={6.5} className="fill-none stroke-muted-foreground/70" strokeWidth={1.5} />
}

export function RoadmapGraph({
  layout,
  topics,
  counts,
  selectedId,
  onSelect,
  svgRef,
}: {
  layout: RoadmapLayout
  topics: TopicData[]
  counts: Map<string, { done: number; total: number }>
  selectedId: string | null
  onSelect: (topicId: string) => void
  svgRef: RefObject<SVGSVGElement | null>
}) {
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))

  const handleKey = (event: KeyboardEvent<SVGGElement>, topicId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect(topicId)
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      role="group"
      aria-label="Roadmap de la materia: grafo de dependencias entre temas"
      className="block max-w-none"
    >
      <defs>
        <marker id="rm-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-muted-foreground/50" />
        </marker>
        <marker id="rm-arrow-done" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={8} markerHeight={8} orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className="fill-primary/80" />
        </marker>
      </defs>

      {layout.lanes.map((lane) =>
        lane.boxed ? (
          <g key={lane.y}>
            <rect
              x={6}
              y={lane.y}
              width={layout.width - 12}
              height={lane.height}
              rx={12}
              className="fill-muted/70 stroke-border"
            />
            {lane.label && (
              <text x={20} y={lane.y + 19} className="fill-muted-foreground text-[11px] font-medium">
                {lane.label}
              </text>
            )}
          </g>
        ) : null,
      )}

      {layout.edges.map((edge) => {
        const sourceDone = topicById.get(edge.from)?.status === 'done'
        return (
          <path
            key={edge.id}
            d={edge.d}
            fill="none"
            strokeWidth={1.75}
            markerEnd={sourceDone ? 'url(#rm-arrow-done)' : 'url(#rm-arrow)'}
            className={sourceDone ? 'stroke-primary/70' : 'stroke-muted-foreground/45'}
          />
        )
      })}

      {layout.nodes.map((node) => {
        const topic = topicById.get(node.id)
        if (!topic) return null

        const count = counts.get(node.id) ?? { done: 0, total: 0 }
        const blocked =
          topic.status === 'pending' &&
          topic.prerequisites.some((id) => topicById.get(id)?.status !== 'done')
        const selected = selectedId === node.id
        const plainTitle = stripMath(topic.title)
        const lines = wrapTitle(plainTitle)
        const firstBaseline = lines.length === 1 ? 29 : 23

        return (
          <g
            key={node.id}
            transform={`translate(${node.x} ${node.y})`}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`${plainTitle}. ${STATUS_LABELS[topic.status]}. ${count.done} de ${count.total} subtemas vistos.${blocked ? ' Tiene temas previos pendientes.' : ''}`}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => handleKey(event, node.id)}
            className="group cursor-pointer outline-none"
          >
            <rect
              width={NODE_W}
              height={NODE_H}
              rx={10}
              strokeWidth={selected ? 2.5 : 1.25}
              strokeDasharray={blocked ? '5 4' : undefined}
              className={cn(
                NODE_STYLES[topic.status],
                selected && 'stroke-primary',
                'transition-colors group-hover:stroke-primary/70 group-focus-visible:stroke-ring group-focus-visible:[stroke-width:3px]',
              )}
            />
            <StatusMark status={topic.status} />
            <text className="fill-foreground text-[13px] font-semibold">
              {lines.map((line, index) => (
                <tspan key={line} x={34} y={firstBaseline + index * 16}>
                  {line}
                </tspan>
              ))}
            </text>
            <text x={16} y={NODE_H - 12} className="fill-muted-foreground text-[11px]">
              {blocked
                ? 'Requiere temas previos'
                : `${count.done}/${count.total} subtemas · ${STATUS_LABELS[topic.status]}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
