// What a playthrough recording holds: one event per line of the exported
// JSONL file. Recordings are made only under `npm run dev:record` (see
// src/dev/recorder.ts) and read by tools that compare them with the bot.
//
// Every event carries the same clocks, so a recording can be laid out on
// either one:
// - t: real milliseconds since this session (page load) started
// - steps: active steps, counted across sessions. A game step is active when
//   the game moved on in it: game speed above 0, so not while the game is
//   paused or the life is over. 20 steps are one second at normal speed.
// - days: the character's age in days (gameData.days)

import type { PlayerAction } from "../ui/actions.ts"

export type { PlayerAction }

// Bumped when an event's shape changes, so readers can tell recordings apart
export const RECORDING_FORMAT = 1

export const NOTE_TAGS = ["bored", "confused", "stuck", "fun", "waiting"] as const
export type NoteTag = typeof NOTE_TAGS[number]

export interface Clocks {
    t: number
    steps: number
    days: number
}

// The choices the player or automation makes, compared before and after
// every action and step to see what changed
export interface Choices {
    job: string
    skill: string
    property: string
    // Sorted names of the misc items in use
    misc: string[]
    paused: boolean
    timeWarping: boolean
    autoPromote: boolean
    autoLearn: boolean
}

export interface Change {
    field: keyof Choices
    from: Choices[keyof Choices]
    to: Choices[keyof Choices]
}

// Why something changed without the player doing it:
// - autoPromote: auto-promote moved to the next job
// - closing: an era closed the job or a misc item in use
// - autoLearn: auto-learn moved to the skill the skill timer picked
// - bankrupt: the coins ran out, so the property and misc items went
// - unknown: none of these (a bug in the recorder, or a new kind of change)
export type AutoCause = "autoPromote" | "closing" | "autoLearn" | "bankrupt" | "unknown"

// The state of the game at a moment, for heartbeats
export interface Snapshot extends Choices {
    coins: number
    evil: number
    jobLevel: number
    skillLevel: number
    lifeOver: boolean
    rebirthOneCount: number
    rebirthTwoCount: number
}

interface Base extends Clocks {
    session: string
    // Order within the session
    seq: number
}

// The first event of every session (page load)
export interface SessionEvent extends Base {
    kind: "session"
    format: number
    startedAt: string
    commit: string
    // Whether the working tree had uncommitted changes
    dirty: boolean
    userAgent: string
    viewport: {width: number, height: number}
}

// A player action, with the save from just before it and what it changed
export interface ActionEvent extends Base {
    kind: "action"
    action: PlayerAction
    saveBefore: string
    changes: Change[]
}

// A change no player action made
export interface AutoEvent extends Base {
    kind: "auto"
    cause: AutoCause
    change: Change
}

// An unlock reached in this life. firstEver: never reached in any recorded
// life before. Unlocks a new life starts with are not events.
export interface UnlockEvent extends Base {
    kind: "unlock"
    name: string
    firstEver: boolean
}

export interface LifeOverEvent extends Base {
    kind: "lifeOver"
    snapshot: Snapshot
}

export interface NoteEvent extends Base {
    kind: "note"
    tag: NoteTag | null
    text: string
}

// Interactions that don't change the game. A tooltip is logged once it has
// been shown for at least TOOLTIP_MIN_MS, when it closes.
export type UiInteraction =
    | {what: "tab", tab: string}
    | {what: "tooltip", target: string, ms: number}

export type UiEvent = Base & {kind: "ui"} & UiInteraction

// The page was shown or hidden, the window gained or lost focus, or the
// player stopped or started using the page (no input for IDLE_AFTER_MS)
export interface AttentionEvent extends Base {
    kind: "attention"
    what: "visible" | "hidden" | "focus" | "blur" | "idle" | "active"
}

// Every 30 s while the page is shown, every 5 min while it's hidden
export interface HeartbeatEvent extends Base {
    kind: "heartbeat"
    snapshot: Snapshot
    save: string
}

// The recording was paused or resumed from the badge. Nothing but these is
// logged while it's paused; the clocks keep counting.
export interface RecordingEvent extends Base {
    kind: "recording"
    what: "paused" | "resumed"
}

export type RecordedEvent = SessionEvent | ActionEvent | AutoEvent | UnlockEvent | LifeOverEvent | NoteEvent
    | UiEvent | AttentionEvent | HeartbeatEvent | RecordingEvent

// Events without what the recorder adds to each one
type Unstamped<E> = E extends Base ? Omit<E, keyof Base> : never
export type EventBody = Unstamped<RecordedEvent>
