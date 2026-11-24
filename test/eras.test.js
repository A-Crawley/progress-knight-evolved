// Eras: the world-year requirement, eras and glimpsing them, and jobs and
// items that close when an era ends.

import { test } from "vitest"
import assert from "node:assert/strict"
import { loadEngine } from "./helpers/engine.js"
import { withTestEra } from "./fixtures/era-data.js"

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

test("the engine can play on test-only game data, and the next load is the real game again", async () => {
    const testGame = await loadEngine({data: withTestEra})
    assert.ok("Test peddler" in testGame.gameData.taskData)
    assert.equal(testGame.api.namesById.test_peddler, "Test peddler")
    assert.equal(testGame.api.jobCategories["Common work"].at(-1), "Test peddler")
    assert.ok(testGame.api.gameData.requirements["Test peddler"])

    const realGame = await loadEngine()
    assert.equal("Test peddler" in realGame.gameData.taskData, false)
    assert.equal(realGame.api.namesById.test_peddler, undefined)
})

// The world day a year starts on
const startOf = year => (year - 1200) * DAYS_PER_YEAR

test("getEra names the era a year is in; the real game has only the Age of Fiefs", async () => {
    const { api } = await loadEngine()
    assert.equal(api.getEra(1199), undefined)
    assert.equal(api.getEra(1200).name, "Age of Fiefs")
    assert.equal(api.getEra(1900).name, "Age of Fiefs")
    assert.equal(api.getNextEra(1200), undefined)
    assert.equal(api.getGlimpsedEra(), undefined)
})

test("with the test era, getEra and getNextEra switch over on its first year", async () => {
    const { api } = await loadEngine({data: withTestEra})
    assert.equal(api.getEra(1229).id, "age_of_fiefs")
    assert.equal(api.getEra(1230).id, "test_age")
    assert.equal(api.getNextEra(1229).id, "test_age")
    assert.equal(api.getNextEra(1230), undefined)
    assert.equal(api.eraStartDay(api.getEra(1230)), startOf(1230))
})

test("the next era is glimpsed once the record is within 20 years of it, and stays glimpsed through rebirths", async () => {
    const { api, gameData } = await loadEngine({data: withTestEra})
    assert.equal(api.getGlimpsedEra(), undefined)

    // This life reaching the last day of 1209 isn't enough
    goToYear(gameData, 1210)
    gameData.days -= 1
    assert.equal(api.getGlimpsedEra(), undefined)

    gameData.days += 1
    assert.equal(api.getGlimpsedEra().id, "test_age")

    // The next life starts in 1200, but the record keeps the glimpse
    api.rebirthOne()
    assert.equal(api.getWorldYear(), 1200)
    assert.equal(api.getGlimpsedEra().id, "test_age")

    // Once a life reaches it, it's reached rather than glimpsed
    goToYear(gameData, 1230)
    assert.equal(api.isEraReached(api.getEra(1230)), true)
    assert.equal(api.getGlimpsedEra(), undefined)
})

test("the record alone decides what's glimpsed, even from a save that only has the record", async () => {
    const { api, gameData } = await loadEngine({data: withTestEra})
    gameData.furthestDay = startOf(1210)
    assert.equal(api.getGlimpsedEra().id, "test_age")
    assert.equal(api.isEraReached(api.getEra(1230)), false)
    gameData.furthestDay = startOf(1230)
    assert.equal(api.isEraReached(api.getEra(1230)), true)
})

test("an era's categories stay out of sight until a life reaches it, then show in every later life", async () => {
    const game = await loadEngine({data: withTestEra})
    const { api, gameData } = game
    goToYear(gameData, 1229)
    game.fastTicks(1)
    assert.equal(api.isUnlocked("test_age_glimpse"), false)

    goToYear(gameData, 1230)
    game.fastTicks(1)
    assert.equal(api.isUnlocked("test_age_glimpse"), true)

    api.rebirthOne()
    game.fastTicks(1)
    assert.equal(api.getWorldYear(), 1200)
    assert.equal(api.isUnlocked("test_age_glimpse"), true)
})
