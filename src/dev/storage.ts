// Where recordings are kept: IndexedDB in the browser (record mode always
// runs on the same port, so it's always the same database), or memory in
// tests. Small values the recorder needs straight away at start, such as the
// active-step clock, go in localStorage instead (see recorder.ts).

import type { RecordedEvent } from "./recording-types.ts"

export interface RecordingStore {
    // Adds an event; writes may finish later, but always in order
    append(event: RecordedEvent): void
    // Every stored event, oldest first
    all(): Promise<RecordedEvent[]>
    clear(): Promise<void>
}

export function memoryStore(): RecordingStore & {events: RecordedEvent[]} {
    const events: RecordedEvent[] = []
    return {
        events,
        append(event) {events.push(event)},
        async all() {return [...events]},
        async clear() {events.length = 0},
    }
}

const DB_NAME = "pk-recorder"
const STORE = "events"

function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

function openDatabase(): Promise<IDBDatabase> {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, {autoIncrement: true})
    return request(open)
}

export function indexedDbStore(): RecordingStore {
    const db = openDatabase()
    // Each write waits for the one before, so events keep their order
    let writes: Promise<unknown> = db
    return {
        append(event) {
            writes = writes.then(async () => {
                const tx = (await db).transaction(STORE, "readwrite")
                await request(tx.objectStore(STORE).add(event))
            }).catch(error => console.warn("Recorder: an event wasn't stored", error))
        },
        async all() {
            await writes
            const tx = (await db).transaction(STORE, "readonly")
            return await request(tx.objectStore(STORE).getAll()) as RecordedEvent[]
        },
        async clear() {
            await writes
            const tx = (await db).transaction(STORE, "readwrite")
            await request(tx.objectStore(STORE).clear())
        },
    }
}

// The events as JSONL: one JSON object per line
export function toJsonl(events: RecordedEvent[]): string {
    return events.map(event => JSON.stringify(event) + "\n").join("")
}
