import { openDB, type IDBPDatabase } from 'idb'
import type { Project } from '../editor/types'

const DB_NAME = 'kepkat'
const DB_VERSION = 1

let database: Promise<IDBPDatabase> | null = null

const getDb = (): Promise<IDBPDatabase> => {
  if (!database) {
    database = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state')
        if (!db.objectStoreNames.contains('media')) db.createObjectStore('media')
      },
    })
  }
  return database
}

export const loadProject = async (): Promise<Project | null> => {
  const db = await getDb()
  const project = (await db.get('state', 'current')) as Project | undefined
  return project ?? null
}

export const saveProject = async (project: Project): Promise<void> => {
  const db = await getDb()
  await db.put('state', project, 'current')
}

export const saveMediaBlob = async (id: string, blob: Blob): Promise<void> => {
  const db = await getDb()
  await db.put('media', blob, id)
}

export const loadMediaBlob = async (id: string): Promise<Blob | undefined> => {
  const db = await getDb()
  return (await db.get('media', id)) as Blob | undefined
}

export const loadMediaBlobs = async (ids: string[]): Promise<Map<string, Blob>> => {
  const db = await getDb()
  const map = new Map<string, Blob>()
  await Promise.all(
    ids.map(async (id) => {
      const blob = (await db.get('media', id)) as Blob | undefined
      if (blob) map.set(id, blob)
    }),
  )
  return map
}

export const deleteMediaBlob = async (id: string): Promise<void> => {
  const db = await getDb()
  await db.delete('media', id)
}

export const clearDatabase = async (): Promise<void> => {
  const db = await getDb()
  await db.clear('state')
  await db.clear('media')
}
