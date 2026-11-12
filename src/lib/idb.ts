const DB_NAME = "dm-table"
const STORE = "images"

let opening: Promise<IDBDatabase> | null = null

function openDb() {
  if (!opening) {
    opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        opening = null
        reject(request.error ?? new Error("Could not open image storage."))
      }
    })
  }
  return opening
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Image storage failed."))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  return requestToPromise(run(db.transaction(STORE, mode).objectStore(STORE)))
}

export function idbSet(key: string, value: string) {
  return withStore("readwrite", (store) => store.put(value, key))
}

export async function idbGet(key: string) {
  const value = await withStore("readonly", (store) => store.get(key))
  return typeof value === "string" ? value : null
}

export function idbDelete(key: string) {
  return withStore("readwrite", (store) => store.delete(key))
}
