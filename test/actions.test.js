// @vitest-environment jsdom

// Player actions (src/ui/actions.ts): each calls the engine, shows the result
// and can be watched by an observer.

import { test, afterEach } from "vitest"
import assert from "node:assert/strict"
import { initGameData, update } from "../src/game/engine.ts"
import { gameData } from "../src/game/state.ts"
import { getSnapshot } from "../src/ui/gameStore.ts"
import { observeActions, selectTask, togglePause, setAutoLearn, setSkillSkipped, rebirthOne } from "../src/ui/actions.ts"

initGameData()
update()

let stopObserving = () => {}
afterEach(() => stopObserving())

test("an action changes the game and asks for a render", () => {
    const frame = getSnapshot()
    const paused = gameData.paused
    togglePause()
    assert.equal(gameData.paused, !paused)
    assert.ok(getSnapshot() > frame)
    togglePause()
    assert.equal(gameData.paused, paused)
})

test("the observer sees each action before it runs, and runs it once", () => {
    const seen = []
    stopObserving = observeActions((action, run) => {
        seen.push({action, before: gameData.automation.autoLearn})
        run()
        seen.push({after: gameData.automation.autoLearn})
    })
    setAutoLearn(true)
    setSkillSkipped("Concentration", true)
    assert.deepEqual(seen.slice(0, 2), [{action: {type: "setAutoLearn", enabled: true}, before: false}, {after: true}])
    assert.deepEqual(seen[2].action, {type: "setSkillSkipped", name: "Concentration", skipped: true})
    setSkillSkipped("Concentration", false)
    setAutoLearn(false)
})

test("an observer that doesn't run the action stops it, and stopping observing puts the plain one back", () => {
    stopObserving = observeActions(() => {})
    const job = gameData.currentJob
    selectTask("Farmer")
    assert.equal(gameData.currentJob, job)
    stopObserving()
    selectTask("Farmer")
    assert.equal(gameData.currentJob.name, "Farmer")
    selectTask(job.name)
})

test("a rebirth through its action counts like the engine's", () => {
    const count = gameData.rebirthOneCount
    rebirthOne()
    assert.equal(gameData.rebirthOneCount, count + 1)
})
