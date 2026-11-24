// @vitest-environment jsdom

// The progress bar painter: bars set straight from the game state on every
// animation frame, outside React.

import { test, beforeEach, afterEach } from "vitest"
import assert from "node:assert/strict"
import { act, cleanup, render } from "@testing-library/react"
import { useRef } from "react"
import { fillTransform, paintBars, useFillBar } from "../src/ui/fillBar.ts"
import { requestRender } from "../src/ui/gameStore.ts"

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(cleanup)

// The share a bar reads, standing in for the game state
let share = 0
// The animation frames' clock (ms)
let now = 0

function Bar({restart, glide}) {
    const fill = useRef(null)
    useFillBar(fill, () => share, restart, glide)
    return <div ref={fill} className="fill" />
}

// The share a bar is painted at, from its transform
function shown(container) {
    const transform = container.querySelector(".fill").style.transform
    return Number(/translateX\((.*)%\)/.exec(transform)[1]) / 100 + 1
}

// Animation frames 1/60 s apart, with a game step every 50 ms as main.tsx
// runs them; each step adds stepGain to the share. Returns the share painted
// on each frame.
function play(container, frames, stepGain) {
    const painted = []
    let stepsDue = 0
    for (let i = 0; i < frames; i++) {
        now += 1000 / 60
        stepsDue += 1000 / 60
        let steps = 0
        while (stepsDue >= 50) { stepsDue -= 50; steps++; share += stepGain }
        paintBars(now, steps)
        painted.push(shown(container))
    }
    return painted
}

// Animation frames with no game step (a paused game), for a bar to finish
// its slide
function idle(container, frames) {
    const painted = []
    for (let i = 0; i < frames; i++) {
        now += 1000 / 60
        paintBars(now, 0)
        painted.push(shown(container))
    }
    return painted
}

test("a bar starts at its share", () => {
    share = 0.25
    const { container } = render(<Bar />)
    assert.equal(container.querySelector(".fill").style.transform, fillTransform(0.25))
    assert.equal(fillTransform(0.5), "translateX(-50%)")
})

test("a bar moves at an even speed and never backwards", () => {
    share = 0
    const { container } = render(<Bar />)
    paintBars(now, 1)
    const painted = play(container, 120, 0.004)
    const moves = painted.slice(1).map((value, i) => value - painted[i])
    assert.ok(moves.every(move => move >= 0), "never backwards")
    // Once it's going, every frame moves it about as far as the game moved
    // in 1/60 s (0.004 per 50 ms step)
    const steady = moves.slice(10)
    const expected = 0.004 * (1000 / 60) / 50
    assert.ok(steady.every(move => Math.abs(move - expected) < expected * 0.05), "even speed: " + steady.map(move => move.toFixed(5)).join(" "))
    assert.ok(Math.abs(painted.at(-1) - share) < 0.005, "a step behind at most")
})

test("with uneven frames (a slow computer), a bar still never moves backwards", () => {
    share = 0
    const { container } = render(<Bar />)
    const frameTimes = [16, 48, 17, 90, 33, 16, 16, 70, 25, 40, 16, 120, 17, 33]
    let last = shown(container)
    let stepsDue = 0
    for (let round = 0; round < 20; round++) {
        for (const time of frameTimes) {
            now += time
            stepsDue += time
            let steps = 0
            while (stepsDue >= 50) { stepsDue -= 50; steps++; share += 0.001 }
            paintBars(now, steps)
            const painted = shown(container)
            assert.ok(painted >= last, "backwards from " + last + " to " + painted)
            last = painted
        }
    }
    assert.ok(share - last < 0.01)
})

test("a bar wraps at a level-up: from empty up to its new share", () => {
    share = 0.9
    const { container } = render(<Bar />)
    play(container, 10, 0.004)
    const before = shown(container)
    share = 0.02
    now += 1000 / 60
    paintBars(now, 1)
    assert.equal(shown(container), 0, "starts again from empty")
    const after = idle(container, 6)
    assert.ok(after.every((value, i) => value >= (after[i - 1] ?? 0)), "then only moves forward")
    assert.ok(Math.abs(after.at(-1) - 0.02) < 1e-9, "up to its new share")
    assert.ok(before > 0.9)
})

test("a player action shows on the bars without a game step", () => {
    share = 0.5
    const { container } = render(<Bar />)
    idle(container, 6)
    share = 0.75
    idle(container, 6)
    assert.equal(shown(container), 0.5, "no step, no change seen")
    act(() => requestRender())
    idle(container, 6)
    assert.equal(shown(container), 0.75)
})

test("a bar starts afresh at its share when it restarts", () => {
    share = 0.3
    const { container, rerender } = render(<Bar restart="Farmer" />)
    idle(container, 6)
    share = 0.8
    rerender(<Bar restart="Miner" />)
    assert.equal(shown(container), 0.8, "no slide from Farmer's share")
})

test("a bar that glides eases from its old task's share to the new one's", () => {
    share = 0.9
    const { container, rerender } = render(<Bar restart="Strength" glide />)
    idle(container, 6)
    share = 0.2
    rerender(<Bar restart="Productivity" glide />)
    assert.equal(shown(container), 0.9, "starts where Strength's bar was")
    const painted = idle(container, 30)
    assert.ok(painted.every((value, i) => value <= (painted[i - 1] ?? 0.9)), "then heads straight down")
    assert.ok(painted[3] < 0.9 && painted[3] > 0.2, "over a few frames, not at once")
    assert.ok(Math.abs(painted.at(-1) - 0.2) < 1e-9, "and settles on its new share")
})

test("an unmounted bar is no longer painted", () => {
    share = 0.1
    const { container, unmount } = render(<Bar />)
    const fill = container.querySelector(".fill")
    unmount()
    share = 0.6
    paintBars(now += 1000 / 60, 1)
    paintBars(now += 100, 0)
    assert.equal(fill.style.transform, fillTransform(0.1))
})
