export const NODE_W = 232
export const NODE_H = 76

const GAP_X = 84
const GAP_Y = 20
const PAD_X = 20
const PAD_Y = 16
const LANE_GAP = 14
const LABEL_H = 28
const ISOLATED_COLUMNS = 4

export type LayoutInput = {
  id: string
  title: string
  position: number
  prerequisites: string[]
}

export type LayoutNode = LayoutInput & { x: number; y: number }
export type LayoutEdge = { id: string; from: string; to: string; d: string }
export type LayoutLane = { y: number; height: number; label: string | null; boxed: boolean }
export type RoadmapLayout = {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  lanes: LayoutLane[]
  width: number
  height: number
}

/**
 * Lays the dependency graph out left to right. Every connected group of topics
 * gets its own lane, so unrelated topics run in parallel lines. Topics with no
 * relation to any other are gathered in a final "independent" lane.
 */
export function layoutRoadmap(input: LayoutInput[]): RoadmapLayout {
  const sorted = [...input].sort((a, b) => a.position - b.position)
  const ids = new Set(sorted.map((topic) => topic.id))
  const order = new Map(sorted.map((topic, index) => [topic.id, index]))

  const prerequisites = new Map(
    sorted.map((topic) => [
      topic.id,
      topic.prerequisites.filter((id) => id !== topic.id && ids.has(id)),
    ]),
  )
  const dependents = new Map<string, string[]>(sorted.map((topic) => [topic.id, []]))
  for (const [id, list] of prerequisites) {
    for (const prerequisite of list) dependents.get(prerequisite)?.push(id)
  }

  const parent = new Map(sorted.map((topic) => [topic.id, topic.id]))
  const find = (id: string): string => {
    let current = id
    while (parent.get(current) !== current) {
      const next = parent.get(current) as string
      parent.set(current, parent.get(next) as string)
      current = parent.get(current) as string
    }
    return current
  }
  for (const [id, list] of prerequisites) {
    for (const prerequisite of list) parent.set(find(id), find(prerequisite))
  }

  const groups = new Map<string, string[]>()
  for (const topic of sorted) {
    const root = find(topic.id)
    groups.set(root, [...(groups.get(root) ?? []), topic.id])
  }
  const connected = [...groups.values()].filter((group) => group.length > 1)
  const isolated = [...groups.values()].filter((group) => group.length === 1).map((g) => g[0])

  const layerCache = new Map<string, number>()
  const visiting = new Set<string>()
  const layerOf = (id: string): number => {
    const cached = layerCache.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    const layer =
      Math.max(-1, ...(prerequisites.get(id) ?? []).map((prerequisite) => layerOf(prerequisite))) +
      1
    visiting.delete(id)
    layerCache.set(id, layer)
    return layer
  }

  const positions = new Map<string, { x: number; y: number }>()
  const lanes: LayoutLane[] = []
  const labelled = connected.length + (isolated.length > 0 ? 1 : 0) > 1
  let cursorY = PAD_Y
  let contentWidth = 0

  connected.forEach((group) => {
    const layers: string[][] = []
    for (const id of [...group].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))) {
      const layer = layerOf(id)
      layers[layer] = [...(layers[layer] ?? []), id]
    }

    const rowIndex = new Map<string, number>()
    const indexLayer = (layer: string[]) => layer.forEach((id, row) => rowIndex.set(id, row))
    layers.forEach(indexLayer)

    const reorder = (layer: string[], neighbours: (id: string) => string[]) => {
      const key = (id: string) => {
        const rows = neighbours(id).map((neighbour) => rowIndex.get(neighbour) ?? 0)
        return rows.length > 0
          ? rows.reduce((sum, row) => sum + row, 0) / rows.length
          : (rowIndex.get(id) ?? 0)
      }
      layer.sort((a, b) => key(a) - key(b) || (order.get(a) ?? 0) - (order.get(b) ?? 0))
      indexLayer(layer)
    }

    for (let pass = 0; pass < 4; pass += 1) {
      for (let index = 1; index < layers.length; index += 1) {
        reorder(layers[index], (id) => prerequisites.get(id) ?? [])
      }
      for (let index = layers.length - 2; index >= 0; index -= 1) {
        reorder(layers[index], (id) => dependents.get(id) ?? [])
      }
    }

    const rows = Math.max(...layers.map((layer) => layer.length))
    const bodyHeight = rows * NODE_H + (rows - 1) * GAP_Y
    const top = cursorY

    layers.forEach((layer, layerIndex) => {
      const offset = ((rows - layer.length) * (NODE_H + GAP_Y)) / 2
      layer.forEach((id, row) => {
        positions.set(id, {
          x: PAD_X + layerIndex * (NODE_W + GAP_X),
          y: top + 12 + offset + row * (NODE_H + GAP_Y),
        })
      })
    })

    const laneHeight = bodyHeight + 24
    lanes.push({ y: cursorY, height: laneHeight, label: null, boxed: labelled })
    contentWidth = Math.max(contentWidth, PAD_X * 2 + layers.length * NODE_W + (layers.length - 1) * GAP_X)
    cursorY += laneHeight + LANE_GAP
  })

  if (isolated.length > 0) {
    const columns = Math.min(ISOLATED_COLUMNS, isolated.length)
    const rows = Math.ceil(isolated.length / columns)
    const top = cursorY + (labelled ? LABEL_H : 0)
    isolated.forEach((id, index) => {
      positions.set(id, {
        x: PAD_X + (index % columns) * (NODE_W + GAP_X),
        y: top + 12 + Math.floor(index / columns) * (NODE_H + GAP_Y),
      })
    })
    const laneHeight = (labelled ? LABEL_H : 0) + rows * NODE_H + (rows - 1) * GAP_Y + 24
    lanes.push({
      y: cursorY,
      height: laneHeight,
      label: labelled ? 'Temas independientes' : null,
      boxed: labelled,
    })
    contentWidth = Math.max(contentWidth, PAD_X * 2 + columns * NODE_W + (columns - 1) * GAP_X)
    cursorY += laneHeight + LANE_GAP
  }

  const nodes: LayoutNode[] = sorted.map((topic) => ({
    ...topic,
    prerequisites: prerequisites.get(topic.id) ?? [],
    ...(positions.get(topic.id) ?? { x: PAD_X, y: PAD_Y }),
  }))

  const edges: LayoutEdge[] = []
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    for (const prerequisiteId of node.prerequisites) {
      const from = nodeById.get(prerequisiteId)
      if (!from) continue
      const x1 = from.x + NODE_W
      const y1 = from.y + NODE_H / 2
      const x2 = node.x
      const y2 = node.y + NODE_H / 2
      const dx = Math.max((x2 - x1) / 2, 24)
      edges.push({
        id: `${from.id}-${node.id}`,
        from: from.id,
        to: node.id,
        d: `M${x1} ${y1} C${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      })
    }
  }

  return {
    nodes,
    edges,
    lanes,
    width: Math.max(contentWidth, NODE_W + PAD_X * 2),
    height: Math.max(cursorY - LANE_GAP + PAD_Y, NODE_H + PAD_Y * 2),
  }
}
