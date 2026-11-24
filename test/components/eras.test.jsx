// @vitest-environment jsdom

// Eras on the page, played on the test-only Test age (1230) from
// test/fixtures/era-data.js.

import { test } from "vitest"
import assert from "node:assert/strict"
import { fireEvent, screen } from "@testing-library/react"
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

// ---------------------------------------------------------------------------
// Jobs, Shop and Working on

const startOf = year => (year - 1200) * YEAR

// A game on the test data, working as a Test trader (level 32 unless given)
// with the Test scroll in use, on a day of a year. record: the furthest
// world day any life has reached before this one; a record past 1230 means
// an earlier life reached the Test age, so its glimpse unlock is reached.
async function eraGame(file, component, props, {year, day = 0, record = 0, traderLevel = 32}) {
    const game = await renderComponent(file, component, props, {
        data: withTestEra,
        before(engine, gameData) {
            gameData.furthestDay = record
            if (record >= startOf(1230)) gameData.requirements["Test age glimpse"].completed = true
            // Enough to have seen the Misc items
            gameData.coins = 5000
            gameData.taskData["Beggar"].level = 10
            gameData.taskData["Farmer"].level = 3
            gameData.taskData["Test trader"].level = traderLevel
            engine.update()
            engine.setTask("Test trader")
            engine.setMisc("Test scroll")
        },
    })
    game.gameData.days = ageFor(year, day)
    game.ticks(1)
    return game
}

const bar = name => row(name).querySelector(".era-bar, button")

test("before any life reaches an era, nothing about it shows in the Jobs table", async () => {
    await eraGame("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { year: 1225 })
    assert.equal(row("Test trader").querySelector(".closes-hint"), null)
    assert.ok(row("Test guild trader").classList.contains("hidden"))
    assert.ok(document.querySelector(".headerRow.Testguild").classList.contains("hidden"), "the Test guild stays out of sight")
})

test("once a life has reached an era, later lives see what closes and what opens then", async () => {
    await eraGame("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { year: 1225, record: startOf(1231) })
    assert.equal(squash(row("Test trader").querySelector(".closes-hint")), "Closes in 1230")

    const opens = row("Test guild trader")
    assert.ok(!opens.classList.contains("hidden"))
    assert.equal(squash(bar("Test guild trader")), "Test guild trader Opens in 1230")
    assert.equal(opens.querySelector("button"), null, "it can't be started")
    assert.equal(squash(opens.querySelector(".level")), "")

    // The Test guild is revealed, its header saying when it opens
    const header = document.querySelector(".headerRow.Testguild")
    assert.ok(!header.classList.contains("hidden"))
    assert.equal(squash(header.querySelector(".era-hint")), "Test age · opens 1230")
    assert.equal(squash(bar("Test guildmaster")), "Test guildmaster Opens in 1230")
})

test("a closed job is muted with its successor, keeps its level, and the successor's tooltip names the bonus", async () => {
    await eraGame("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { year: 1230 })
    const closed = row("Test trader")
    assert.equal(squash(closed.querySelector(".era-closed")), "Test trader Closed in 1230 · became Test guild trader →")
    assert.equal(closed.querySelector(".era-closed a").getAttribute("href"), "#row%20Test%20guild%20trader")
    assert.equal(closed.querySelector("button"), null)
    assert.equal(squash(closed.querySelector(".level")), "32")
    assert.equal(squash(closed.querySelector(".xpGain")), "—")

    const successor = row("Test guild trader")
    assert.equal(squash(successor.querySelector(".active-badge")), "Active")
    assert.equal(squash(successor.querySelector(".tooltip-source")), "×4.2 XP from Test trader")
    assert.equal(row("Farmer").querySelector(".tooltip-source"), null)
})

test("the Next row passes over jobs an era has closed or not yet opened", async () => {
    await eraGame("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { year: 1225, record: startOf(1231), traderLevel: 2 })
    // Merchant is next in Common work; the Test jobs after it aren't named
    assert.match(squash(document.getElementById("Common work")), /Next: Fisherman/)
})

test("Working on says an era closed your job, and where you went, for 30 days", async () => {
    const game = await eraGame("Sidebar.tsx", "Sidebar", {}, { year: 1229, day: 364, traderLevel: 2 })
    assert.equal(document.querySelector(".closing-note"), null)
    game.ticks(10)
    assert.equal(squash(document.querySelector(".closing-note")), "Test trader closed in 1230 · now Farmer")
    assert.equal(squash(document.querySelector(".quick-bar.job .name")), "Farmer")

    game.gameData.days += 30
    game.ticks(1)
    assert.equal(document.querySelector(".closing-note"), null)
})

test("in the Shop, an item about to close says so, and its successor shows locked", async () => {
    await eraGame("ShopTable.tsx", "ShopTable", {}, { year: 1225, record: startOf(1231) })
    assert.equal(squash(row("Test scroll").querySelector(".closes-hint")), "Closes in 1230")
    assert.equal(squash(bar("Test ledger")), "Test ledger Opens in 1230")
    assert.equal(squash(row("Test ledger").querySelector(".expense")), "—")
})

test("in the Shop, a closed item is muted with its successor, which can be bought", async () => {
    await eraGame("ShopTable.tsx", "ShopTable", {}, { year: 1230 })
    const closed = row("Test scroll")
    assert.equal(squash(closed.querySelector(".era-closed")), "Test scroll Closed in 1230 · became Test ledger →")
    assert.equal(squash(closed.querySelector(".in-use")), "—")
    assert.equal(squash(closed.querySelector(".expense")), "—")
    assert.ok(closed.querySelector(".effect").classList.contains("era-muted"))

    const ledger = row("Test ledger")
    assert.ok(!ledger.classList.contains("hidden"))
    assert.ok(ledger.querySelector("button.item-button"))
})

// ---------------------------------------------------------------------------
// The era banner

const banner = () => document.querySelector(".era-banner")

test("no banner in the first era", async () => {
    await eraGame("EraBanner.tsx", "EraBanner", {}, { year: 1225 })
    assert.equal(banner(), null)
})

test("entering a later era shows a banner with what closed and what took its place, until Onward", async () => {
    const game = await eraGame("EraBanner.tsx", "EraBanner", {}, { year: 1230 })
    assert.equal(squash(banner().querySelector(".era-banner-kicker")), "A new era · Summer 1, 1230")
    assert.equal(squash(banner().querySelector("h2")), "The Test age")
    assert.ok(banner().classList.contains("fx-anim"), "its entrance follows the effects setting")
    assert.deepEqual([...banner().querySelectorAll(".era-handoff")].map(squash),
        ["Test trader Test guild trader ×4.2 XP", "Test scroll Test ledger"])
    assert.equal(document.querySelector(".era-banner-slot").getAttribute("aria-live"), "polite")

    fireEvent.click(screen.getByText("Onward"))
    assert.equal(banner(), null)
    assert.deepEqual(Array.from(game.gameData.eraBannersDismissed), ["test_age"])
    game.ticks(5)
    assert.equal(banner(), null, "dismissed for the rest of the life")
})

test("the banner leaves out what this life never unlocked", async () => {
    // The Test trader needs Beggar 5: without it, only the Test scroll is listed
    const game = await eraGame("EraBanner.tsx", "EraBanner", {}, { year: 1230, traderLevel: 0 })
    game.gameData.requirements["Test trader"].completed = false
    game.rerender()
    assert.deepEqual([...banner().querySelectorAll(".era-handoff")].map(squash), ["Test scroll Test ledger"])
})

// ---------------------------------------------------------------------------
// The Chronicle

// A game where life I reached Summer 1240, in the Test age, and this life
// (II) is in 1215
async function chronicleGame() {
    const game = await renderComponent("Chronicle.tsx", "Chronicle", {}, {
        data: withTestEra,
        before(engine, gameData) {
            gameData.days = ageFor(1240)
            engine.rebirthOne()
            gameData.days = ageFor(1215)
        },
    })
    game.ticks(1)
    return game
}

const bands = () => [...document.querySelectorAll(".chronicle-era")]

test("the reach chart lays a band for each era behind the bars, labelled along the top", async () => {
    await chronicleGame()
    assert.deepEqual(bands().map(squash), ["Age of Fiefs 1200", "Test age 1230"])
    assert.ok(!bands()[0].classList.contains("chronicle-era-later"))
    assert.ok(bands()[1].classList.contains("chronicle-era-later"))
    assert.ok(document.querySelector(".chronicle-reach").classList.contains("chronicle-reach-eras"))
    assert.match(document.querySelector(".chronicle-reach").getAttribute("aria-label"), /Eras: Age of Fiefs from 1200, Test age from 1230\.$/)
})

test("the part of a life's bar in a later era takes the era colour, and the list names the eras each life reached", async () => {
    await chronicleGame()
    const rows = [...document.querySelectorAll(".chronicle-reach-row")]
    // Newest first: this life hasn't reached 1230, life I has
    assert.equal(rows[0].querySelector(".chronicle-bar-era"), null)
    const part = rows[1].querySelector(".chronicle-bar-era")
    assert.ok(part)
    assert.ok(parseFloat(part.style.left) > 0 && parseFloat(part.style.width) > 0)

    const lives = [...document.querySelectorAll(".chronicle-life")]
    assert.deepEqual(lives.map(life => [...life.querySelectorAll(".chronicle-era-chip")].map(squash)),
        [["Age of Fiefs"], ["Age of Fiefs", "Test age"]])
    assert.ok([...document.querySelectorAll(".chronicle-legend > span")].map(squash).includes("Life, Test age"))
})

test("with only the first era reached and nothing glimpsed, the Chronicle names no eras in its list", async () => {
    const game = await renderComponent("Chronicle.tsx", "Chronicle", {}, {
        data: withTestEra,
        before(engine, gameData) {
            gameData.days = ageFor(1205)
            engine.rebirthOne()
        },
    })
    game.ticks(1)
    assert.deepEqual(bands().map(squash), ["Age of Fiefs 1200"])
    assert.equal(document.querySelector(".chronicle-era-chip"), null)
})
