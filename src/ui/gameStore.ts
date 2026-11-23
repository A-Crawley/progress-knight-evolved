// Connects the game state to React. The state stays a plain object that the
// game loop changes outside React (see state.ts). React components read it
// directly while rendering; this store only tells them when to render again:
// its snapshot is a frame number, which moves on every 100 ms of game time
// and whenever the player does something.

import { useSyncExternalStore } from "react"
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

// About 10 frames per second is plenty for numbers and progress bars
export const renderInterval = 100

// Renders come after a fixed number of game steps (renderInterval of game
// time), not after a fixed time on the clock. The progress bars ease over
// one render interval (--pk-tick in tokens.css), so if renders came after
// 1, 2 or 3 steps the bars would keep speeding up and slowing down.
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

// The game state, for a component that shows it. The component renders
// again with every frame. Never change the state while rendering: player
// actions call the engine's functions and then requestRender().
export function useGame(): GameData {
    useSyncExternalStore(subscribe, getSnapshot)
    return gameData
}
