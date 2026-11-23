// Connects the game state to React. The state stays a plain object that the
// game loop changes outside React (see state.ts). React components read it
// directly while rendering; this store only tells them when to render again:
// its snapshot is a frame number, which moves on every 100 ms of game time
// and whenever the player does something.

import { useRef, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { gameData } from "../game/state.ts"
import type { GameData } from "../game/state.ts"
import { updateSpeed } from "../game/rules.ts"

let frame = 0
const listeners = new Set<() => void>()

export function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {listeners.delete(listener)}
}

export function getSnapshot(): number {
    return frame
}

// Shows the current game state on the next render
export function requestRender(): void {
    frame++
    for (const listener of listeners) listener()
}

// Shows the current game state before returning, for tests that read the
// page straight after a game step
export function renderNow(): void {
    flushSync(requestRender)
}

// About 10 frames per second is plenty for numbers. The progress bars don't
// wait for frames: fillBar.ts paints them on every animation frame.
export const renderInterval = 100

// Frames come after a fixed number of game steps (renderInterval of game
// time), not after a fixed time on the clock, so numbers count at the
// game's own pace.
export const stepsPerRender = renderInterval * updateSpeed / 1000
let stepsSinceRender = 0

// Called on each animation frame with the number of game steps the frame
// ran. Renders once every stepsPerRender steps; returns whether it did.
export function onGameSteps(steps: number): boolean {
    stepsSinceRender += steps
    if (stepsSinceRender < stepsPerRender) return false
    stepsSinceRender %= stepsPerRender
    requestRender()
    return true
}

// One value a component shows, picked out of the game state by select. The
// component renders again only when the value changes, not with every frame.
// select runs on every frame, so keep it cheap, and never change the state in
// it. It should return a primitive, usually the text on screen; an object or
// array needs isEqual (shallowEqual or sameData below), or it would count as
// changed every time.
export function useGameValue<T>(select: () => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
    // The last value returned, so an equal value gives React the same snapshot
    const last = useRef<{value: T} | null>(null)
    const getValue = () => {
        const next = select()
        if (last.current && isEqual(last.current.value, next)) return last.current.value
        last.current = {value: next}
        return next
    }
    return useSyncExternalStore(subscribe, getValue)
}

// Two objects (or arrays) with the same keys and Object.is-equal values
export function shallowEqual<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) return true
    if (typeof a != "object" || typeof b != "object" || a === null || b === null) return false
    const keysA = Object.keys(a) as (keyof T)[]
    if (keysA.length != Object.keys(b).length) return false
    return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]))
}

// Two plain values (primitives, arrays and plain objects of them) with the
// same contents, however deep
export function sameData<T>(a: T, b: T): boolean {
    if (Object.is(a, b)) return true
    if (typeof a != "object" || typeof b != "object" || a === null || b === null) return false
    if (Array.isArray(a) != Array.isArray(b)) return false
    const keysA = Object.keys(a) as (keyof T)[]
    if (keysA.length != Object.keys(b).length) return false
    return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && sameData(a[key], b[key]))
}

// The game state, for a component that shows it. The component renders
// again with every frame. Never change the state while rendering: player
// actions call the engine's functions and then requestRender().
export function useGame(): GameData {
    useSyncExternalStore(subscribe, getSnapshot)
    return gameData
}
