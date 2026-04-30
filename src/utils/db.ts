import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'auravideo';
const DB_VERSION = 1;

export interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
  thumbnail?: string;
}

export interface StoredProject extends ProjectMeta {
  // serialized editor state
  state: any;
  // asset binary references stored separately in 'blobs' by `${projectId}:${assetId}`
  assetIds: string[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB();
  const all = (await db.getAll('projects')) as StoredProject[];
  return all
    .map(({ id, name, updatedAt, thumbnail }) => ({ id, name, updatedAt, thumbnail }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<StoredProject | undefined> {
  const db = await getDB();
  return (await db.get('projects', id)) as StoredProject | undefined;
}

export async function getBlob(projectId: string, assetId: string): Promise<Blob | undefined> {
  const db = await getDB();
  return (await db.get('blobs', `${projectId}:${assetId}`)) as Blob | undefined;
}

export async function putProject(p: StoredProject, blobs: Map<string, Blob>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['projects', 'blobs'], 'readwrite');
  await tx.objectStore('projects').put(p);
  for (const [assetId, blob] of blobs) {
    await tx.objectStore('blobs').put(blob, `${p.id}:${assetId}`);
  }
  await tx.done;
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  // delete the project record and any blobs whose key starts with `${id}:`
  const tx = db.transaction(['projects', 'blobs'], 'readwrite');
  await tx.objectStore('projects').delete(id);
  const blobStore = tx.objectStore('blobs');
  let cursor = await blobStore.openCursor();
  const prefix = `${id}:`;
  while (cursor) {
    if (typeof cursor.key === 'string' && cursor.key.startsWith(prefix)) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('meta', value, key);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get('meta', key)) as T | undefined;
}
