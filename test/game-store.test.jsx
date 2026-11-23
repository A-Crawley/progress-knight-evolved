// @vitest-environment jsdom

// The store that tells React components when to show the game state again.

import { test, beforeEach, afterEach } from "vitest"
import assert from "node:assert/strict"
import { act, cleanup, render } from "@testing-library/react"
import { initGameData, update, rebirthOne } from "../src/game/engine.ts"
import { gameData } from "../src/game/state.ts"
import { serializeGameData } from "../src/game/save.ts"
import { getSnapshot, onGameSteps, requestRender, renderInterval, stepsPerRender, subscribe, useGame } from "../src/ui/gameStore.ts"

initGameData()
update()

// React needs to be told it's running in tests to allow act()
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true })
afterEach(cleanup)

test("the frame moves on once every 100 ms of game time", async () => {
    assert.equal(renderInterval, 100)
    assert.equal(stepsPerRender, 2)
    const start = getSnapshot()
    // One second of game steps, run 0 to 3 at a time like uneven animation frames
    const frames = [1, 0, 1, 1, 0, 2, 1, 1, 1, 0, 3, 1, 1, 2, 1, 0, 2, 1, 1]
    assert.equal(frames.reduce((a, b) => a + b), 20)
    let rendered = 0
    for (const steps of frames) {
        if (onGameSteps(steps)) rendered++
    }
    assert.equal(rendered, 10)
    assert.equal(getSnapshot(), start + rendered)
    // A frame that runs past two renders' worth of steps still renders once
    assert.equal(onGameSteps(1), false)
    assert.equal(onGameSteps(3), true)
    assert.equal(getSnapshot(), start + rendered + 1)
    assert.equal(onGameSteps(1), false)
    onGameSteps(1)
})

test("requestRender moves the frame on and tells subscribers", async () => {
    let calls = 0
    const unsubscribe = subscribe(() => calls++)
    const before = getSnapshot()
    requestRender()
    assert.equal(getSnapshot(), before + 1)
    assert.equal(calls, 1)
    unsubscribe()
    requestRender()
    assert.equal(calls, 1, "no calls after unsubscribing")
})

function Coins() {
    const game = useGame()
    return <span>{Math.floor(game.coins)}</span>
}

test("a component using useGame shows the state as of the last frame", async () => {
    const { container } = render(<Coins />)
    const shown = container.textContent
    update()
    assert.equal(container.textContent, shown, "game steps alone don't render")
    act(() => requestRender())
    assert.equal(container.textContent, String(Math.floor(gameData.coins)))
})

test("rendering with the store never changes the game state", async () => {
    function Everything() {
        const game = useGame()
        return <span>{JSON.stringify(serializeGameData())}{game.days}</span>
    }
    rebirthOne()
    gameData.coins = 1e9
    const before = JSON.stringify(serializeGameData())
    render(<Everything />)
    act(() => { requestRender(); requestRender() })
    assert.equal(JSON.stringify(serializeGameData()), before)
})
