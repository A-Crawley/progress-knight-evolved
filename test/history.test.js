// The world's history: lives as spans of world days, and the record, for the
// Chronicle, the Almanac and the past lives table.

import { test } from "vitest"
import assert from "node:assert/strict"
import { loadEngine } from "./helpers/engine.js"
import { toRoman } from "../src/game/history.ts"

const YEAR = 365

test("a new game's history is the life being lived, woken on day 0", async () => {
    const game = await loadEngine()
    const [span] = game.api.getLifeSpans()
    assert.equal(game.api.getLifeSpans().length, 1)
    assert.equal(span.life, 1)
    assert.equal(span.living, true)
    assert.equal(span.end, null)
    assert.equal(span.woke, 0)
    assert.equal(span.ended, game.api.getWorldDay())
})

test("every life wakes on the same day and ends where its age took it", async () => {
    const game = await loadEngine()
    const { gameData } = game
    gameData.days = 66 * YEAR
    game.api.rebirthOne()
    gameData.days = 41 * YEAR
    game.api.rebirthTwo()
    gameData.days = 20 * YEAR
    const spans = game.api.getLifeSpans()
    assert.deepEqual(spans.map(span => [span.life, span.end, span.age, span.living]),
        [[1, "rebirth", 66, false], [2, "evil", 41, false], [3, null, 20, true]])
    assert.deepEqual(spans.map(span => [span.woke / YEAR, span.ended / YEAR]), [[0, 52], [0, 27], [0, 6]])
    assert.equal(game.api.yearOf(spans[2].ended), 1206)
    assert.equal(game.api.nextWakeDay(), 0, "the next life wakes on the same day")
})

test("the history copes with fifty lives", async () => {
    const game = await loadEngine()
    const { gameData } = game
    for (let i = 0; i < 60; i++) {
        gameData.days = (60 + i) * YEAR
        game.api.rebirthOne()
    }
    const spans = game.api.getLifeSpans()
    assert.equal(spans.length, 51)
    assert.equal(spans[0].life, 11)
    assert.equal(spans[50].life, 61)
    assert.ok(spans.every(span => span.woke == 0), "every life shares the start")
    assert.equal(game.api.yearOf(spans[49].ended), 1305, "life 60 touched the eye at 119")
})

test("a life reaches the exact season its age took it to", async () => {
    const game = await loadEngine()
    const { gameData } = game
    gameData.days = 70.6 * YEAR
    game.api.rebirthOne()
    const [past] = game.api.getLifeSpans()
    assert.equal(past.age, 70)
    assert.equal(game.api.reachedText(past.ended), "Winter 1256")
    assert.equal(game.api.reachedText(0), "Summer 1200")
    assert.equal(game.api.ageOn(past.ended), 70)
    assert.equal(game.api.ageOn(0), 14)
})

test("the record names the life that reached it first, and what this life has passed", async () => {
    const game = await loadEngine()
    const { gameData } = game
    gameData.days = 20 * YEAR
    let record = game.api.getRecord()
    assert.deepEqual([record.life, record.living, record.previous, record.age], [1, true, null, 20], "a first life holds it")

    gameData.days = 70.6 * YEAR
    game.api.rebirthOne()
    gameData.days = 70.6 * YEAR
    game.api.rebirthTwo()
    gameData.days = 30 * YEAR
    record = game.api.getRecord()
    assert.deepEqual([record.life, record.living, record.age], [1, false, 70], "life 2 only matched life 1")
    assert.equal(game.api.reachedText(record.day), "Winter 1256")
    assert.equal(record.previous, record.day)

    gameData.days = 71 * YEAR
    record = game.api.getRecord()
    assert.deepEqual([record.life, record.living, record.age], [3, true, 71], "this life passes it")
    assert.equal(game.api.reachedText(record.previous), "Winter 1256", "the furthest the past lives got")

    gameData.lives.shift()
    gameData.lives.shift()
    gameData.days = 30 * YEAR
    record = game.api.getRecord()
    assert.deepEqual([record.life, record.living, record.age], [null, false, 70], "the life that set it was dropped")
})

test("Roman numerals", async () => {
    assert.deepEqual([1, 4, 6, 9, 14, 40, 49, 50, 90, 400, 1994].map(toRoman),
        ["I", "IV", "VI", "IX", "XIV", "XL", "XLIX", "L", "XC", "CD", "MCMXCIV"])
})
