// @vitest-environment jsdom

// The Chronicle in the Settings tab: how far every life reached, as a reach
// chart with the record marked, and a list with a strip of seasons per life
// on the same scale.

import { test } from "vitest"
import assert from "node:assert/strict"
import { fireEvent, screen } from "@testing-library/react"
import { renderComponent } from "../helpers/react.js"
import { getRowHeight, getScale, getStripStyle } from "../../src/ui/Chronicle.tsx"

const YEAR = 365
const section = () => document.getElementById("chronicle")
const squash = element => element.textContent.replace(/\s+/g, " ").trim()
// A row's parts, one after another
const parts = row => [...row.querySelectorAll(":scope > *, :scope > .chronicle-title > *")]
    .filter(part => !part.classList.contains("chronicle-title")).map(squash).filter(Boolean).join(" ")
const lifeRows = () => [...section().querySelectorAll(".chronicle-life")].map(parts)
const summary = () => squash(section().querySelector(".chronicle-summary"))
const chart = () => section().querySelector(".chronicle-reach")
const legend = () => [...section().querySelectorAll(".chronicle-legend > span")].map(squash)

// Lives that end at these ages, then a living one at 32
async function withLives(ages, { evilAt = [] } = {}) {
    const game = await renderComponent("Chronicle.tsx", "Chronicle")
    for (const age of ages) {
        game.gameData.days = age * YEAR
        evilAt.includes(age) ? game.engine.rebirthTwo() : game.engine.rebirthOne()
    }
    game.gameData.days = 32 * YEAR + 100
    game.rerender()
    return game
}

test("a new game has no Chronicle until the Amulet tab appears", async () => {
    const game = await renderComponent("Chronicle.tsx", "Chronicle")
    assert.equal(section(), null)
    game.gameData.days = 25 * YEAR
    game.ticks(1)
    assert.ok(section())
    assert.equal(summary(), "1 life · furthest Summer 1211 (age 25)")
    assert.equal(squash(section().querySelector(".settings-help")), "Every life begins in Summer 1200. Live longer to see more of the world.")
})

test("the summary, and the newest three lives with the date each reached", async () => {
    await withLives([41, 70, 52, 66, 82], { evilAt: [52] })
    assert.equal(squash(screen.getByRole("heading", { name: "Chronicle" })), "Chronicle")
    assert.equal(summary(), "6 lives · furthest Summer 1268 (age 82)")
    assert.deepEqual(lifeRows(), [
        "Life 6 · now Living, age 32 now",
        "Life 5 Touched the eye at 82 · furthest Summer 1268",
        "Life 4 Touched the eye at 66 Summer 1252",
    ])
    assert.equal(section().querySelector(".chronicle-gap"), null, "no growing-up rows")
    assert.ok(section().querySelector(".chronicle-life .chronicle-years-now"))

    const more = screen.getByRole("button", { name: "Show all 6 lives" })
    assert.equal(more.getAttribute("aria-expanded"), "false")
    fireEvent.click(more)
    assert.equal(lifeRows().length, 6)
    assert.equal(lifeRows()[3], "Life 3 Embraced evil at 52 Summer 1238")
    assert.equal(lifeRows()[5], "Life 1 Touched the eye at 41 Summer 1227")
    fireEvent.click(screen.getByRole("button", { name: "Show recent lives" }))
    assert.equal(lifeRows().length, 3)
})

test("the life being lived updates, and takes the record once it passes it", async () => {
    const game = await withLives([70])
    assert.equal(lifeRows()[0], "Life 2 · now Living, age 32 now")
    game.gameData.days = 40 * YEAR
    game.rerender()
    assert.equal(lifeRows()[0], "Life 2 · now Living, age 40 now")
    assert.equal(summary(), "2 lives · furthest Summer 1256 (age 70)")

    game.gameData.days = 75 * YEAR + 200
    game.rerender()
    assert.equal(summary(), "2 lives · furthest Winter 1261 (age 75)")
    assert.deepEqual(lifeRows(), ["Life 2 · now Living, age 75 · furthest now", "Life 1 Touched the eye at 70 Summer 1256"])
})

test("the reach chart gives every life a bar from 1200, newest first, with the record marked", async () => {
    await withLives([41, 70, 52], { evilAt: [52] })
    assert.equal(chart().getAttribute("role"), "img")
    assert.equal(chart().getAttribute("aria-label"),
        "4 lives, each a bar from Summer 1200 to the date it reached. The furthest, life II, reached Summer 1256.")
    const rows = [...chart().querySelectorAll(".chronicle-reach-row")]
    assert.deepEqual(rows.map(row => squash(row.querySelector(".chronicle-numeral"))), ["IV", "III", "II", "I"])
    const bars = rows.map(row => row.querySelector(".chronicle-bar"))
    // 56 years on a 100-year scale
    assert.deepEqual(bars.map(bar => Math.round(parseFloat(bar.style.width))), [18, 38, 56, 27])
    assert.ok(bars[0].classList.contains("chronicle-bar-now"))
    assert.ok(bars[1].classList.contains("chronicle-bar-evil"))
    assert.ok(!bars[2].classList.contains("chronicle-bar-evil") && !bars[2].classList.contains("chronicle-bar-now"))
    assert.equal(rows[2].title, "Life II: Touched the eye at 70 · furthest, reached Summer 1256")
    assert.equal(rows[0].title, "Life IV: Living, age 32, now in Summer 1218")

    assert.equal(Math.round(parseFloat(section().querySelector(".chronicle-furthest").style.left)), 56)
    assert.equal(squash(section().querySelector(".chronicle-furthest-label")), "Furthest · Summer 1256")
    assert.deepEqual([...section().querySelectorAll(".chronicle-ticks span")].map(squash), ["1200", "1225", "1250", "1275"])
    assert.deepEqual(legend(), ["Life", "Ended in evil", "This life", "Summer", "Winter"])
})

test("the list draws each life's strip on the reach chart's scale", async () => {
    await withLives([41, 70])
    const widths = [...section().querySelectorAll(".chronicle-track")].map(track => Math.round(parseFloat(track.style.width)))
    assert.deepEqual(widths, [18, 56, 27])
})

test("a record set by a life since dropped still shows, with no life named", async () => {
    const game = await withLives([70])
    game.gameData.furthestDay = 96 * YEAR + 300
    game.rerender()
    assert.equal(summary(), "2 lives · furthest Winter 1296 (age 110)")
    assert.match(chart().getAttribute("aria-label"), / The furthest reached Winter 1296\.$/)
    assert.ok(lifeRows().every(row => !row.includes("furthest")))
    assert.equal(squash(section().querySelector(".chronicle-furthest-label")), "Furthest · Winter 1296")
})

test("the scale is round years a little past the record, with at most five labels", async () => {
    assert.deepEqual(getScale(0), { years: 20, step: 5 })
    assert.deepEqual(getScale(18 * YEAR), { years: 20, step: 5 })
    assert.deepEqual(getScale(56 * YEAR), { years: 100, step: 25 })
    assert.deepEqual(getScale(96.8 * YEAR), { years: 100, step: 25 })
    assert.deepEqual(getScale(99.5 * YEAR), { years: 200, step: 50 })
    assert.deepEqual(getScale(186 * YEAR), { years: 200, step: 50 })
    assert.deepEqual(getScale(3000 * YEAR), { years: 5000, step: 1000 })
    for (const years of [0, 10, 56, 340, 3000, 60000, 6e6]) {
        const scale = getScale(years * YEAR)
        assert.ok(scale.years > years && scale.years / scale.step <= 5, String(years))
    }
})

test("fifty lives and long reaches fit without scrolling: rows thin out, and numerals with them", async () => {
    assert.equal(getRowHeight(1), 16)
    assert.equal(getRowHeight(6), 16)
    assert.equal(getRowHeight(20), 10)
    assert.equal(getRowHeight(51), 6)

    const game = await withLives([...Array.from({ length: 54 }, (_, i) => 40 + (i * 7) % 160), 15])
    const rows = [...chart().querySelectorAll(".chronicle-reach-row")]
    assert.equal(rows.length, 51)
    assert.ok(chart().classList.contains("chronicle-reach-dense"))
    assert.equal(chart().style.getPropertyValue("--row-height"), "6px")
    assert.equal(rows.filter(row => row.querySelector(".chronicle-numeral-fifth")).length, 10, "every fifth life keeps its numeral")
    assert.ok(rows.every(row => parseFloat(row.querySelector(".chronicle-bar").style.width) <= 100))
    assert.match(summary(), /^51 lives · furthest (Summer|Winter) \d+ \(age \d+\)$/)
    assert.equal(game.errors?.length ?? 0, 0)
})

test("each strip starts on the right day of the year", async () => {
    // Waking on Winter 1: the strip starts half a year into the pattern
    const style = getStripStyle(183, 183 + 2 * YEAR)
    assert.equal(style.backgroundImage, "repeating-linear-gradient(90deg, "
        + "var(--pk-stripe-summer) -25.0685%, var(--pk-stripe-summer) 0.0000%, "
        + "var(--pk-stripe-winter) 0.0000%, var(--pk-stripe-winter) 24.9315%)")
    await withLives([41])
    const strip = section().querySelector(".chronicle-track")
    assert.equal(strip.getAttribute("role"), "img")
    assert.equal(strip.getAttribute("aria-label"), "18 years of Summers and Winters, from Summer 1200 to Summer 1218")
})

const unlock = (game, ...names) => { for (const name of names) game.gameData.requirements[name].completed = true }

test("each life marks the events it lived through, rare ones in gold, and names them", async () => {
    const game = await withLives([70])
    // Life 1 woke in 1200 and touched the eye at 70, in 1256
    assert.equal(section().querySelector(".chronicle-lane"), null, "no events before they are unlocked")
    assert.equal(section().querySelector(".chronicle-events"), null)
    assert.deepEqual(legend(), ["Life", "Ended in evil", "This life", "Summer", "Winter"])

    unlock(game, "Shop", "Arcane glimpse")
    game.rerender()
    const [, first] = section().querySelectorAll(".chronicle-life")
    assert.equal(squash(first.querySelector(".chronicle-events")),
        "Arcane Conjunction 1200, 1207, 1214, 1221, 1228, 1235, 1242, 1249 · 12 Hard Winters")
    const marks = [...first.querySelectorAll(".chronicle-event")]
    assert.equal(marks.length, 8 + 12)
    assert.equal(marks.filter(mark => mark.classList.contains("chronicle-rare")).length, 8)
    // The first, Hard Winter 1200, runs from day 183 to 365 of a 56-year life
    assert.equal(marks[0].style.left, 183 / (56 * 365) * 100 + "%")
    assert.equal(first.querySelector(".chronicle-track").getAttribute("aria-label"), "56 years of Summers and Winters, from Summer 1200 to Summer 1256, 20 events")
    assert.deepEqual(legend(), ["Life", "Ended in evil", "This life", "Summer", "Winter", "Event (a season)", "Rare event"])
})

test("the life being lived counts the events that have begun, one alone by name", async () => {
    const game = await renderComponent("Chronicle.tsx", "Chronicle")
    unlock(game, "Shop")
    game.gameData.days = 25 * 365
    game.ticks(1)
    // 1200 to 1211: Hard Winters in 1200, 1205 and 1210
    assert.equal(squash(section().querySelector(".chronicle-events")), "3 Hard Winters")
    game.gameData.days = 14 * 365 + 200
    game.rerender()
    assert.equal(squash(section().querySelector(".chronicle-events")), "Hard Winter")
})
