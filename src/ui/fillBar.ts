// The progress bars, painted outside React. A bar's fill is full width and
// slid into place with a transform, which never lays out the page again (the
// bar around it clips it). Once per animation frame, paintBars sets each
// bar's transform directly, without rendering anything.
//
// Each time the game steps, every bar reads its new share. Over the time
// since the last steps, it then slides from the share it read then to this
// one. So a bar runs one sample behind the game, at the speed the game really
// moved, and it never moves backwards. When the share drops (a level up, a
// new season, a rebirth) the bar wraps: it starts again from empty and slides
// up to the new share.

import { useLayoutEffect, useRef } from "react"
import type { RefObject } from "react"
import { updateSpeed } from "../game/rules.ts"
import { subscribe } from "./gameStore.ts"

interface Bar {
    element: HTMLElement
    // The bar's share now, from 0 to 1
    read: () => number
    // It slides from `from` to `to` between samples
    from: number
    to: number
    shown: number
    // The transform last written, so an unchanged one isn't written again
    written: string
}

const bars = new Set<Bar>()

// A game step's time on the clock (ms): how long a bar takes to slide to a
// share after a player action
const stepTime = 1000 / updateSpeed
// The longest a slide takes, so a bar doesn't crawl after a long frame or a
// return from a background tab
const maxSlide = 250

let sampledAt = -Infinity
let slideTime = stepTime
// The state changed without a game step (a player action), so the bars read
// their shares again on the next frame
let changed = false
subscribe(() => {changed = true})

function clamp(share: number): number {
    return share > 1 ? 1 : share > 0 ? share : 0
}

// The transform for a share, from 0 (empty) to 1 (full)
export function fillTransform(share: number): string {
    return "translateX(" + (share - 1) * 100 + "%)"
}

function paint(bar: Bar, share: number) {
    bar.shown = share
    const transform = fillTransform(share)
    if (transform == bar.written) return
    bar.written = transform
    bar.element.style.transform = transform
}

// Reads every bar's share. After game steps a bar slides on from the share it
// read last time, where it has just arrived if the steps kept to time; after
// a player action, from where it is.
function sample(now: number, time: number, afterSteps: boolean) {
    sampledAt = now
    slideTime = time
    changed = false
    for (const bar of bars) {
        const share = clamp(bar.read())
        bar.from = share < bar.to ? 0 : afterSteps ? bar.to : bar.shown
        bar.to = share
    }
}

// Called on every animation frame with the number of game steps it ran
export function paintBars(now: number, steps: number): void {
    if (steps > 0) sample(now, Math.min(maxSlide, Math.max(1, now - sampledAt)), true)
    else if (changed) sample(now, stepTime, false)
    const progress = Math.min(1, (now - sampledAt) / slideTime)
    for (const bar of bars) paint(bar, bar.from + (bar.to - bar.from) * progress)
}

// Puts every bar at its share at once, for tests that read a bar straight
// after a game step
export function paintBarsNow(): void {
    for (const bar of bars) {
        const share = clamp(bar.read())
        bar.from = bar.to = share
        paint(bar, share)
    }
}

// Makes the element ref points to a progress bar's fill, filled to the share
// select returns (from 0 to 1). select runs on every game step, so keep it
// cheap, and never change the state in it. The bar starts at its share, and
// starts again there whenever restart changes (a new task, say) rather than
// sliding to it.
export function useFillBar(ref: RefObject<HTMLElement | null>, select: () => number, restart?: string): void {
    // The latest select, so a bar always reads what its component now shows
    const latest = useRef(select)
    useLayoutEffect(() => {latest.current = select})
    useLayoutEffect(() => {
        const element = ref.current
        if (!element) return
        const share = clamp(latest.current())
        const bar: Bar = {element, read: () => latest.current(), from: share, to: share, shown: share, written: ""}
        paint(bar, share)
        bars.add(bar)
        return () => {bars.delete(bar)}
    }, [ref, restart])
}
