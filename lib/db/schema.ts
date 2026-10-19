import {
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  vector,
} from 'drizzle-orm/pg-core'
import type { ProgressStatus, Source } from '@/lib/types'

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

export const subjects = pgTable('subjects', {
  id: id(),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  program: text('program'),
  fceiaSubjectId: integer('fceiaSubjectId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const materials = pgTable('materials', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('apunte'),
  content: text('content').notNull(),
  sourceName: text('sourceName'),
  externalKey: text('externalKey'),
  chunkCount: integer('chunkCount').notNull().default(0),
  pagesChecked: boolean('pagesChecked').notNull().default(false),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

/** Original uploaded file (PDF or image), kept so it can be viewed in the browser. */
export const materialFiles = pgTable('material_files', {
  materialId: text('materialId').primaryKey(),
  userId: text('userId').notNull(),
  mimeType: text('mimeType').notNull(),
  fileName: text('fileName').notNull(),
  data: bytea('data').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const chunks = pgTable('chunks', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  materialId: text('materialId').notNull(),
  position: integer('position').notNull(),
  page: integer('page'),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }).notNull(),
})

export const topics = pgTable('topics', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull().default(''),
  position: integer('position').notNull().default(0),
  prerequisites: jsonb('prerequisites').$type<string[]>().notNull().default([]),
  status: text('status').$type<ProgressStatus>().notNull().default('pending'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const subtopics = pgTable('subtopics', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  topicId: text('topicId').notNull(),
  title: text('title').notNull(),
  position: integer('position').notNull().default(0),
  status: text('status').$type<ProgressStatus>().notNull().default('pending'),
  sources: jsonb('sources').$type<Source[]>().notNull().default([]),
})

export const practiceExercises = pgTable('practice_exercises', {
  id: id(),
  userId: text('userId').notNull(),
  subjectId: text('subjectId').notNull(),
  topicId: text('topicId').notNull(),
  subtopicId: text('subtopicId').notNull(),
  materialId: text('materialId'),
  statement: text('statement').notNull(),
  position: integer('position').notNull().default(0),
  done: boolean('done').notNull().default(false),
})
