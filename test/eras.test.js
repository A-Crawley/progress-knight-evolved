// Eras: the world-year requirement, eras and glimpsing them, and jobs and
// items that close when an era ends.

import { test } from "vitest"
import assert from "node:assert/strict"
import { loadEngine } from "./helpers/engine.js"

const DAYS_PER_YEAR = 365
const WAKE_AGE_DAYS = 365 * 14

// Sets the age so the world is on the first day of a year
function goToYear(gameData, year) {
    gameData.days = WAKE_AGE_DAYS + (year - 1200) * DAYS_PER_YEAR
}

test("a world-year requirement is met once a life reaches that year", async () => {
    const { api, gameData } = await loadEngine()
    const requirement = api.createRequirement({id: "test", name: "Test", requires: [{year: 1210}]})
    assert.equal(requirement.type, "year")

    goToYear(gameData, 1209)
    gameData.days += 364
    assert.equal(api.getWorldYear(), 1209)
    assert.equal(requirement.isCompleted(), false)

    gameData.days += 1
    assert.equal(api.getWorldYear(), 1210)
    assert.equal(requirement.isCompleted(), true)
})

test("a world-year requirement can't be mixed with other kinds", async () => {
    const { api } = await loadEngine()
    assert.throws(() => api.createRequirement({id: "test", name: "Test", requires: [{year: 1210}, {age: 20}]}), /mixes different kinds/)
})
