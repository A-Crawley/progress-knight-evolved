// @vitest-environment jsdom

// Eras on the page, played on the test-only Test age (1230) from
// test/fixtures/era-data.js.

import { test } from "vitest"
import assert from "node:assert/strict"
import { renderComponent } from "../helpers/react.js"
import { withTestEra } from "../fixtures/era-data.js"

const row = name => document.getElementById("row " + name)

test("a component can be rendered on test-only game data", async () => {
    await renderComponent("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { data: withTestEra })
    assert.ok(row("Test trader"))
})

test("the next render is the real game again", async () => {
    await renderComponent("TaskTable.tsx", "TaskTable", { kind: "jobs" })
    assert.equal(row("Test trader"), null)
})

const YEAR = 365
const squash = element => element.textContent.replace(/\s+/g, " ").trim()
const card = () => document.getElementById("almanac")
// The age that puts the world on a day of a year (day 0 is its first)
const ageFor = (year, day = 0) => (14 + year - 1200) * YEAR + day

async function almanacOn(days, before) {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} }, { data: withTestEra, before })
    game.gameData.days = days
    game.ticks(1)
    return game
}

test("the Almanac names the era under the date; the first era in the quiet colour, with nothing glimpsed", async () => {
    await almanacOn(ageFor(1205, 41))
    const era = card().querySelector(".almanac-era")
    assert.equal(squash(era), "Age of Fiefs")
    assert.ok(!era.classList.contains("almanac-era-later"))
    assert.equal(card().querySelector(".almanac-glimpse"), null)
})

test("once the record is within 20 years of the next era, the Almanac says how far off it is", async () => {
    await almanacOn(ageFor(1207, 41), (engine, gameData) => { gameData.furthestDay = 1210 * YEAR - 1200 * YEAR })
    assert.equal(squash(card().querySelector(".almanac-glimpse")), "Test age in 22 years Summer 1230")
    assert.equal(squash(card().querySelector(".almanac-glimpse strong")), "Test age")
})

test("a later era shows in the era colour, with Began for its first 30 days", async () => {
    const game = await almanacOn(ageFor(1230, 3))
    const era = card().querySelector(".almanac-era")
    assert.equal(squash(era), "Test age Began")
    assert.ok(era.classList.contains("almanac-era-later"))
    assert.equal(card().querySelector(".almanac-glimpse"), null, "nothing left to glimpse")

    game.gameData.days = ageFor(1230, 30)
    game.ticks(1)
    assert.equal(squash(card().querySelector(".almanac-era")), "Test age")
})
