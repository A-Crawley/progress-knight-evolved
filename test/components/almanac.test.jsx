// @vitest-environment jsdom

// The Almanac in the sidebar: today's date, the days to the next season, the
// season's bar, the record and the way to the Chronicle.

import { test } from "vitest"
import assert from "node:assert/strict"
import { fireEvent, screen } from "@testing-library/react"
import { renderComponent } from "../helpers/react.js"

const YEAR = 365
const card = () => document.getElementById("almanac")
const squash = element => element.textContent.replace(/\s+/g, " ").trim()

test("the Almanac is out of sight until the Amulet tab appears", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    assert.ok(card().classList.contains("hidden"))
    game.gameData.days = 25 * YEAR
    game.ticks(1)
    assert.ok(!card().classList.contains("hidden"))
})

test("once a life has been lived it stays, though the Amulet tab hides again", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    game.engine.rebirthOne()
    game.ticks(1)
    assert.ok(!game.engine.isUnlocked("rebirth_tab"))
    assert.ok(!card().classList.contains("hidden"))
})

test("today's date, the days to the next season and how far through this one", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    game.gameData.days = 14 * YEAR + 41.5
    game.rerender()
    assert.equal(squash(document.getElementById("almanacDate")), "Summer 42, 1200")
    assert.equal(squash(card().querySelector(".almanac-next")), "142 days to Winter")
    assert.equal(card().querySelector(".season-icon").dataset.season, "summer")
    const bar = card().querySelector(".almanac-bar")
    assert.equal(bar.getAttribute("role"), "img")
    assert.equal(bar.getAttribute("aria-label"), "Summer, day 42 of 183")
    assert.equal(bar.firstChild.style.getPropertyValue("--fill"), String(41 / 183))
    assert.equal(bar.firstChild.style.backgroundColor, "var(--pk-season-summer)")

    game.gameData.days = 14 * YEAR + 364
    game.rerender()
    assert.equal(squash(document.getElementById("almanacDate")), "Winter 182, 1200")
    assert.equal(squash(card().querySelector(".almanac-next")), "1 day to Summer")
    assert.equal(card().querySelector(".almanac-bar").getAttribute("aria-label"), "Winter, day 182 of 182")
    assert.equal(card().querySelector(".almanac-bar").firstChild.style.backgroundColor, "var(--pk-season-winter)")
})

const record = () => card().querySelector(".almanac-record")

test("the record line names the furthest date, the life that reached it and its age", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    game.gameData.days = 25 * YEAR
    game.rerender()
    assert.equal(record(), null, "a first life has nothing to beat")

    for (const age of [41, 70]) {
        game.gameData.days = age * YEAR
        game.engine.rebirthOne()
    }
    game.gameData.days = 110 * YEAR + 300
    game.engine.rebirthTwo()
    game.gameData.days = 34 * YEAR
    game.rerender()
    // Life III ended at 110, 300 days into its year: Winter 1296
    assert.equal(squash(record()), "Furthest: Winter 1296 life III, age 110")
    assert.ok(!record().classList.contains("almanac-record-new"))

    game.gameData.lives.splice(0, 3)
    game.rerender()
    assert.equal(squash(record()), "Furthest: Winter 1296 age 110", "the life that set it was dropped")
})

test("once this life passes the record it reads New furthest, in the gain colour", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    game.gameData.days = 110 * YEAR + 300
    game.engine.rebirthOne()
    game.gameData.days = 110 * YEAR + 200
    game.rerender()
    assert.equal(squash(record()), "Furthest: Winter 1296 life I, age 110", "not passed yet")

    game.gameData.days = 114 * YEAR + 195
    game.rerender()
    assert.equal(squash(record()), "New furthest past Winter 1296")
    assert.ok(record().classList.contains("almanac-record-new"))
})

test("the link asks for the Chronicle", async () => {
    let opened = 0
    await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() { opened++ } })
    fireEvent.click(screen.getByRole("button", { name: "Chronicle in Settings" }))
    assert.equal(opened, 1)
})

const WINTER = 183
const unlock = (game, ...names) => { for (const name of names) game.gameData.requirements[name].completed = true }
const nextLine = () => card().querySelector(".almanac-next-event")
const toggle = () => card().querySelector(".almanac-toggle")

test("events stay out of the Almanac until they are unlocked", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    game.gameData.days = 17 * YEAR + WINTER + 3 // Winter 1203: Hard Winter
    game.rerender()
    assert.equal(card().querySelector(".almanac-event"), null)
    assert.equal(nextLine(), null)
    assert.equal(toggle(), null)
})

test("between events, the next one and when it comes", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    unlock(game, "Shop")
    game.gameData.days = 17 * YEAR + 50
    game.rerender()
    assert.equal(squash(nextLine()), "Next: Hard Winter in 133 days")
    assert.equal(card().querySelector(".almanac-event"), null)
})

test("an event running shows its name, the days left, its effects and what it is", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    unlock(game, "Shop")
    game.gameData.days = 17 * YEAR + WINTER + 3 // Winter 1203: Hard Winter
    game.rerender()
    const box = card().querySelector(".almanac-event")
    assert.equal(squash(box.querySelector(".almanac-event-head")), "Hard Winter Began 179 days left")
    const effects = [...box.querySelectorAll(".almanac-effects > span")]
    assert.deepEqual(effects.map(squash), ["×1.25 upkeep", "×1.5 skill XP"])
    assert.deepEqual(effects.map(effect => effect.style.color), ["var(--pk-loss)", "var(--pk-gain-text)"])
    assert.match(squash(box), /The roads close; a good season to study\.$/)
    assert.equal(nextLine(), null, "no next line while an event runs")

    game.gameData.days = 17 * YEAR + WINTER + 30
    game.rerender()
    assert.equal(card().querySelector(".almanac-began"), null, "Began only for its first days")
})

test("events that fall together each get a box", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    unlock(game, "Shop", "Arcane glimpse")
    game.gameData.days = 47 * YEAR + WINTER + 3 // Winter 1233: Hard Winter and Arcane Conjunction
    game.rerender()
    assert.deepEqual([...card().querySelectorAll(".almanac-event strong")].map(squash), ["Hard Winter", "Arcane Conjunction"])
})

test("Coming up lists the next three events", async () => {
    const game = await renderComponent("Almanac.tsx", "Almanac", { onOpenChronicle() {} })
    unlock(game, "Shop", "Military glimpse")
    game.gameData.days = 14 * YEAR + 365 + 10 // Summer 1201
    game.rerender()
    assert.equal(squash(toggle()), "Coming up")
    assert.equal(toggle().getAttribute("aria-expanded"), "false")
    assert.equal(card().querySelector(".almanac-upcoming"), null)

    fireEvent.click(toggle())
    assert.equal(squash(toggle()), "Hide")
    assert.equal(toggle().getAttribute("aria-expanded"), "true")
    const items = [...card().querySelectorAll(".almanac-coming")].map(squash)
    assert.deepEqual(items, [
        "Tournament Summer in 355 days Summer 1202 · ×2 Military XP",
        "Hard Winter in 2 years Winter 1203 · ×1.25 upkeep, ×1.5 skill XP",
        "Tournament Summer in 3 years Summer 1205 · ×2 Military XP",
    ])
    assert.equal(nextLine(), null, "the list replaces the next line")
    fireEvent.click(toggle())
    assert.equal(card().querySelector(".almanac-upcoming"), null)
    assert.equal(squash(nextLine()), "Next: Tournament Summer in 355 days")
})
