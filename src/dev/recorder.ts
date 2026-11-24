// The playthrough recorder: logs what the player does and what the game does
// on its own while they play, for comparing their play with the bot's. It
// runs only under `npm run dev:record` (see startRecording.ts); nothing in
// the game imports it, and the built site doesn't contain it.
//
// It watches the game through two hooks that do nothing otherwise: every
// player action (observeActions in actions.ts) and every game step
// (observeSteps in engine.ts). After each, it compares the player's choices
// with how they were, so a change after an action is the player's and a
// change after a step is automation's. See recording-types.ts for the events.

import { gameData } from "../game/state.ts"
import { isLifeOver, observeSteps } from "../game/engine.ts"
import { isClosed } from "../game/eras.ts"
import { exportSave } from "../game/save.ts"
import type { Job } from "../game/classes.ts"
import { observeActions } from "../ui/actions.ts"
import type { PlayerAction } from "../ui/actions.ts"
import { RECORDING_FORMAT } from "./recording-types.ts"
import type { AutoCause, Change, Choices, EventBody, NoteTag, RecordedEvent, Snapshot, UiInteraction,
    AttentionEvent } from "./recording-types.ts"
import type { RecordingStore } from "./storage.ts"
import { toJsonl } from "./storage.ts"

export const HEARTBEAT_MS = 30 * 1000
export const HIDDEN_HEARTBEAT_MS = 5 * 60 * 1000
// The badge asks for an export once this long has passed since the last one
export const EXPORT_REMINDER_MS = 3 * 60 * 60 * 1000

// What the recorder keeps between sessions, so its clocks and "first ever"
// unlocks carry on across page loads
export interface RecorderMeta {
    activeSteps: number
    everUnlocked: string[]
    // When the recordings were last exported (or first recorded), ms since 1970
    lastExportAt: number | null
}

export interface MetaStore {
    load(): RecorderMeta
    save(meta: RecorderMeta): void
}

const META_KEY = "pk-recorder"

export function localMeta(): MetaStore {
    return {
        load() {
            const meta: RecorderMeta = {activeSteps: 0, everUnlocked: [], lastExportAt: null}
            try {
                const saved = JSON.parse(localStorage.getItem(META_KEY) ?? "null") as Partial<RecorderMeta> | null
                if (typeof saved?.activeSteps == "number" && saved.activeSteps >= 0) meta.activeSteps = saved.activeSteps
                if (Array.isArray(saved?.everUnlocked)) meta.everUnlocked = saved.everUnlocked.filter(name => typeof name == "string")
                if (typeof saved?.lastExportAt == "number") meta.lastExportAt = saved.lastExportAt
            } catch {
                // Start the clocks again
            }
            return meta
        },
        save(meta) {
            localStorage.setItem(META_KEY, JSON.stringify(meta))
        },
    }
}

export function memoryMeta(initial?: Partial<RecorderMeta>): MetaStore & {meta: RecorderMeta} {
    const store = {
        meta: {activeSteps: 0, everUnlocked: [], lastExportAt: null, ...initial} as RecorderMeta,
        load: () => structuredClone(store.meta),
        save: (meta: RecorderMeta) => {store.meta = structuredClone(meta)},
    }
    return store
}

export interface RecorderOptions {
    store: RecordingStore
    meta: MetaStore
    // The commit the dev server is running, and whether it had uncommitted changes
    build: {commit: string, dirty: boolean}
    now?: () => number
}

// What the badge shows
export interface RecorderStatus {
    recording: boolean
    startedAt: number
    events: number
    exportDue: boolean
}

export function readChoices(): Choices {
    return {
        job: gameData.currentJob.name,
        skill: gameData.currentSkill.name,
        property: gameData.currentProperty.name,
        misc: gameData.currentMisc.map(item => item.name).sort(),
        paused: gameData.paused,
        timeWarping: gameData.timeWarpingEnabled,
        autoPromote: gameData.automation.autoPromote,
        autoLearn: gameData.automation.autoLearn,
    }
}

export function diffChoices(before: Choices, after: Choices): Change[] {
    const changes: Change[] = []
    for (const field of Object.keys(before) as (keyof Choices)[]) {
        const from = before[field], to = after[field]
        const same = Array.isArray(from) && Array.isArray(to) ? from.join("\n") == to.join("\n") : from === to
        if (!same) changes.push({field, from, to})
    }
    return changes
}

// Why a step changed a choice. Only automation, era closings and going
// bankrupt change them in a step (see update() in engine.ts).
function autoCause(change: Change, changes: Change[]): AutoCause {
    switch (change.field) {
        case "job": {
            const job = gameData.taskData[change.from as string] as Job | undefined
            return job && isClosed(job.baseData) ? "closing" : "autoPromote"
        }
        case "skill": return "autoLearn"
        case "property": return "bankrupt"
        case "misc": return changes.some(other => other.field == "property") ? "bankrupt" : "closing"
        default: return "unknown"
    }
}

function completedUnlocks(): string[] {
    return Object.keys(gameData.requirements).filter(name => gameData.requirements[name].completed)
}

export function readSnapshot(): Snapshot {
    return {
        ...readChoices(),
        coins: gameData.coins,
        evil: gameData.evil,
        jobLevel: gameData.currentJob.level,
        skillLevel: gameData.currentSkill.level,
        lifeOver: isLifeOver(),
        rebirthOneCount: gameData.rebirthOneCount,
        rebirthTwoCount: gameData.rebirthTwoCount,
    }
}

const rebirths: PlayerAction["type"][] = ["rebirthOne", "rebirthTwo"]

export class Recorder {
    private readonly store: RecordingStore
    private readonly metaStore: MetaStore
    private readonly meta: RecorderMeta
    private readonly build: {commit: string, dirty: boolean}
    private readonly now: () => number
    private readonly listeners = new Set<() => void>()
    private stopWatching: (() => void)[] = []
    private heartbeatTimer: ReturnType<typeof setInterval> | undefined

    readonly session: string
    readonly startedAt: number
    private started = false
    private recording = true
    private seq = 0
    private events = 0
    private hidden = false
    private lastHeartbeat = 0

    // What the last action or step left, to compare the next one with
    private choices: Choices = readChoices()
    private lastDays = gameData.days
    private lifeOver = isLifeOver()
    private unlocked = new Set<string>()
    private everUnlocked: Set<string>
    // After a rebirth, the unlocks the new life starts with come in the
    // first step; they aren't events
    private newLife = false

    constructor({store, meta, build, now = Date.now}: RecorderOptions) {
        this.store = store
        this.metaStore = meta
        this.meta = meta.load()
        this.build = build
        this.now = now
        this.startedAt = now()
        this.session = new Date(this.startedAt).toISOString()
        this.everUnlocked = new Set(this.meta.everUnlocked)
    }

    // Starts recording. Calling it again does nothing.
    start(): void {
        if (this.started) return
        this.started = true
        this.rebaseline()
        for (const name of this.unlocked) this.everUnlocked.add(name)
        if (this.meta.lastExportAt === null) this.meta.lastExportAt = this.startedAt
        this.saveMeta()
        this.emit({
            kind: "session", format: RECORDING_FORMAT, startedAt: this.session,
            commit: this.build.commit, dirty: this.build.dirty,
            userAgent: typeof navigator == "undefined" ? "" : navigator.userAgent,
            viewport: typeof window == "undefined" ? {width: 0, height: 0} : {width: window.innerWidth, height: window.innerHeight},
        })
        this.stopWatching = [
            observeActions((action, run) => this.onAction(action, run)),
            observeSteps(() => this.onStep()),
        ]
        this.lastHeartbeat = this.now()
        this.heartbeatTimer = setInterval(() => this.onHeartbeatTimer(), HEARTBEAT_MS)
    }

    // Stops watching the game (for tests; the page records until it closes)
    stop(): void {
        for (const stop of this.stopWatching) stop()
        this.stopWatching = []
        clearInterval(this.heartbeatTimer)
        this.saveMeta()
        this.started = false
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener)
        return () => {this.listeners.delete(listener)}
    }

    status(): RecorderStatus {
        return {
            recording: this.recording,
            startedAt: this.startedAt,
            events: this.events,
            exportDue: this.now() - (this.meta.lastExportAt ?? this.startedAt) >= EXPORT_REMINDER_MS,
        }
    }

    get activeSteps(): number {
        return this.meta.activeSteps
    }

    // Pauses or resumes recording. The clocks keep counting while paused.
    setRecording(recording: boolean): void {
        if (recording == this.recording) return
        if (!recording) this.emit({kind: "recording", what: "paused"})
        this.recording = recording
        if (recording) this.emit({kind: "recording", what: "resumed"})
        this.notify()
    }

    note(tag: NoteTag | null, text: string): void {
        this.emit({kind: "note", tag, text: text.trim()})
    }

    ui(interaction: UiInteraction): void {
        this.emit({kind: "ui", ...interaction})
    }

    attention(what: AttentionEvent["what"]): void {
        if (what == "visible" || what == "hidden") {
            this.hidden = what == "hidden"
            // The page may be closed while hidden, so keep the clocks now
            if (this.hidden) this.saveMeta()
        }
        this.emit({kind: "attention", what})
    }

    heartbeat(): void {
        this.lastHeartbeat = this.now()
        this.saveMeta()
        this.emit({kind: "heartbeat", snapshot: readSnapshot(), save: exportSave()})
    }

    // Every stored event as JSONL, and the export reminder starts again
    async exportJsonl(): Promise<string> {
        const text = toJsonl(await this.store.all())
        this.meta.lastExportAt = this.now()
        this.saveMeta()
        this.notify()
        return text
    }

    async clearRecordings(): Promise<void> {
        await this.store.clear()
        this.meta.lastExportAt = this.now()
        this.saveMeta()
        this.notify()
    }

    private onHeartbeatTimer(): void {
        const interval = this.hidden ? HIDDEN_HEARTBEAT_MS : HEARTBEAT_MS
        // Timers can fire a little early, so allow a second
        if (this.now() - this.lastHeartbeat >= interval - 1000) this.heartbeat()
        else this.notify()
    }

    private onAction(action: PlayerAction, run: () => void): void {
        const saveBefore = this.recording ? exportSave() : ""
        const before = readChoices()
        run()
        const after = readChoices()
        this.emit({kind: "action", action, saveBefore, changes: diffChoices(before, after)})
        this.choices = after
        if (rebirths.includes(action.type)) {
            this.rebaseline()
            this.newLife = true
        }
    }

    private onStep(): void {
        if (gameData.days > this.lastDays) this.meta.activeSteps++
        this.lastDays = gameData.days

        const choices = readChoices()
        const changes = diffChoices(this.choices, choices)
        for (const change of changes) this.emit({kind: "auto", cause: autoCause(change, changes), change})
        this.choices = choices

        for (const name of completedUnlocks()) {
            if (this.unlocked.has(name)) continue
            this.unlocked.add(name)
            if (!this.newLife) this.emit({kind: "unlock", name, firstEver: !this.everUnlocked.has(name)})
            this.everUnlocked.add(name)
        }
        this.newLife = false

        const lifeOver = isLifeOver()
        if (lifeOver && !this.lifeOver) this.emit({kind: "lifeOver", snapshot: readSnapshot()})
        this.lifeOver = lifeOver
    }

    // Takes the game as it is now as the starting point for comparisons
    private rebaseline(): void {
        this.choices = readChoices()
        this.lastDays = gameData.days
        this.lifeOver = isLifeOver()
        this.unlocked = new Set(completedUnlocks())
    }

    private emit(body: EventBody): void {
        if (!this.recording) return
        const event = {
            ...body,
            session: this.session,
            seq: this.seq++,
            t: this.now() - this.startedAt,
            steps: this.meta.activeSteps,
            days: gameData.days,
        } as RecordedEvent
        this.store.append(event)
        this.events++
        this.notify()
    }

    private notify(): void {
        for (const listener of this.listeners) listener()
    }

    private saveMeta(): void {
        this.meta.everUnlocked = [...this.everUnlocked]
        this.metaStore.save(this.meta)
    }
}

let current: Recorder | null = null

// The page's one recorder, started on the first call; later calls return it
export function startRecorder(options: RecorderOptions): Recorder {
    if (!current) {
        current = new Recorder(options)
        current.start()
    }
    return current
}
