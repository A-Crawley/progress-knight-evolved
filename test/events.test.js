// Season-long events on the world calendar: the fixed schedule, which run
// today, which come next and which fell in a span of the past.

import { test } from "vitest"
import assert from "node:assert/strict"
import { loadEngine } from "./helpers/engine.js"

const YEAR = 365
const WINTER = 183
const ids = occurrences => occurrences.map(found => found.event.id + " " + found.year)

function unlock(game, ...names) {
    for (const name of names) game.gameData.requirements[name].completed = true
}

test("events come round every so many years from the epoch, before it too", async () => {
    const game = await loadEngine()
    const event = id => game.api.events.find(found => found.id == id)
    const years = (id, from, to) => Array.from({ length: to - from }, (_, i) => from + i).filter(year => game.api.happensIn(event(id), year))
    assert.deepEqual(years("tournament_summer", 1195, 1210), [1196, 1199, 1202, 1205, 1208])
    assert.deepEqual(years("hard_winter", 1190, 1211), [1193, 1198, 1203, 1208])
    assert.deepEqual(years("arcane_conjunction", 1190, 1215), [1191, 1198, 1205, 1212])
    assert.deepEqual(years("blood_moon", 1180, 1230), [1191, 1204, 1217])
    assert.deepEqual(game.api.events.map(found => game.api.isRare(found)), [false, false, true, true])
})

test("an event runs for the whole of its season", async () => {
    const game = await loadEngine()
    assert.deepEqual(ids(game.api.getEventsOn(0)), [], "every life's first year is quiet")
    assert.deepEqual(ids(game.api.getEventsOn(WINTER)), [])
    assert.deepEqual(ids(game.api.getEventsOn(2 * YEAR)), ["tournament_summer 1202"])
    assert.deepEqual(ids(game.api.getEventsOn(2 * YEAR + 182.9)), ["tournament_summer 1202"])
    assert.deepEqual(ids(game.api.getEventsOn(2 * YEAR + WINTER)), [])
    assert.deepEqual(ids(game.api.getEventsOn(4 * YEAR + WINTER)), ["blood_moon 1204"])
    assert.deepEqual(ids(game.api.getEventsOn(3 * YEAR + WINTER + 10)), ["hard_winter 1203"])
    const [hardWinter] = game.api.getEventsOn(3 * YEAR + WINTER + 10)
    assert.deepEqual([hardWinter.start, hardWinter.end], [3 * YEAR + WINTER, 4 * YEAR])
})

test("only events whose unlock has been reached are running", async () => {
    const game = await loadEngine()
    const { gameData } = game
    assert.deepEqual(ids(game.api.getActiveEvents()), [], "a new game knows no events")
    unlock(game, "Military glimpse")
    gameData.days = 14 * YEAR + 2 * YEAR + 10
    assert.deepEqual(ids(game.api.getActiveEvents()), ["tournament_summer 1202"])
    gameData.days = 14 * YEAR + 33 * YEAR + WINTER + 3
    assert.deepEqual(ids(game.api.getActiveEvents()), [])
    unlock(game, "Shop", "Arcane glimpse")
    assert.deepEqual(ids(game.api.getActiveEvents()), ["hard_winter 1233", "arcane_conjunction 1233"])
    const [hardWinter] = game.api.getActiveEvents()
    assert.equal(game.api.isNew(hardWinter, game.api.getWorldDay()), true)
    assert.equal(game.api.isNew(hardWinter, 33 * YEAR + WINTER + 19.9), true)
    assert.equal(game.api.isNew(hardWinter, 33 * YEAR + WINTER + 20), false)
})

test("the next events the player can see, earliest first", async () => {
    const game = await loadEngine()
    assert.deepEqual(game.api.getUpcomingEvents(0, 3), [], "none unlocked")
    unlock(game, "Shop")
    assert.deepEqual(ids(game.api.getUpcomingEvents(0, 3)), ["hard_winter 1203", "hard_winter 1208", "hard_winter 1213"])
    unlock(game, "Military glimpse", "Arcane glimpse", "Dark magic")
    assert.deepEqual(ids(game.api.getUpcomingEvents(0, 6)),
        ["tournament_summer 1202", "hard_winter 1203", "blood_moon 1204", "tournament_summer 1205", "arcane_conjunction 1205", "tournament_summer 1208"])
    // An event running now isn't upcoming
    assert.deepEqual(ids(game.api.getUpcomingEvents(3 * YEAR + WINTER + 10, 2)), ["blood_moon 1204", "tournament_summer 1205"])
})

test("the events in a span of days, including ones it only partly covers", async () => {
    const game = await loadEngine()
    assert.deepEqual(ids(game.api.getEventsInSpan(100, 4 * YEAR + 1)),
        ["tournament_summer 1202", "hard_winter 1203"])
    assert.deepEqual(ids(game.api.getEventsInSpan(2 * YEAR + 100, 4 * YEAR + WINTER + 1)),
        ["tournament_summer 1202", "hard_winter 1203", "blood_moon 1204"])
    assert.deepEqual(ids(game.api.getEventsInSpan(-YEAR, 0)), ["tournament_summer 1199"], "years before the epoch too")
    assert.deepEqual(ids(game.api.getEventsInSpan(-YEAR + WINTER, 0)), [])
    assert.deepEqual(ids(game.api.getEventsInSpan(10, 10)), [])
    assert.equal(game.api.getEventsInSpan(0, 56 * YEAR).length, 18 + 11 + 8 + 4)
})

// A day in the given year and season of the first life
function setWorldDay(game, day) {
    game.gameData.days = 14 * YEAR + day
}

test("Tournament Summer doubles Military XP while it runs, once Military is in sight", async () => {
    const game = await loadEngine()
    const footman = game.api.getTaskById("footman")
    const farmer = game.api.getTaskById("farmer")
    setWorldDay(game, 2 * YEAR + 50) // Summer 1202
    const before = [footman.getXpGain(), farmer.getXpGain()]
    unlock(game, "Military glimpse")
    assert.deepEqual([footman.getXpGain(), farmer.getXpGain()], [before[0] * 2, before[1]])
    setWorldDay(game, 3 * YEAR + 50) // Summer 1203: no tournament
    assert.deepEqual([footman.getXpGain(), farmer.getXpGain()], before)
})

test("Hard Winter raises upkeep and skill XP, not job XP", async () => {
    const game = await loadEngine()
    const { gameData } = game
    game.api.setProperty("Tent")
    game.api.setMisc("Book")
    const strength = game.api.getTaskById("strength")
    const farmer = game.api.getTaskById("farmer")
    setWorldDay(game, 3 * YEAR + WINTER + 1) // Winter 1203
    const before = { expense: game.api.getExpense(), skill: strength.getXpGain(), job: farmer.getXpGain() }
    assert.ok(before.expense > 0)
    unlock(game, "Shop")
    const tent = gameData.itemData["Tent"], book = gameData.itemData["Book"]
    assert.equal(game.api.getExpense(), Math.round(tent.baseData.expense * 1.25) + Math.round(book.baseData.expense * 1.25))
    // XP gains are rounded to whole points
    assert.ok(Math.abs(strength.getXpGain() - before.skill * 1.5) <= 1, String(strength.getXpGain()))
    assert.ok(strength.getXpGain() > before.skill)
    assert.equal(farmer.getXpGain(), before.job)
    setWorldDay(game, 4 * YEAR + 1) // Summer 1204
    assert.equal(game.api.getExpense(), before.expense)
})

test("Arcane Conjunction triples Magic and Arcane XP; Blood Moon deepens evil gained", async () => {
    const game = await loadEngine()
    const mana = game.api.getTaskById("mana_control")
    const mage = game.api.getTaskById("mage")
    const strength = game.api.getTaskById("strength")
    setWorldDay(game, 5 * YEAR + WINTER + 1)
    const before = [mana.getXpGain(), mage.getXpGain(), strength.getXpGain(), game.api.getEvilGain()]
    unlock(game, "Arcane glimpse", "Dark magic")
    assert.deepEqual([mana.getXpGain(), mage.getXpGain(), strength.getXpGain(), game.api.getEvilGain()],
        [before[0] * 3, before[1] * 3, before[2], before[3]], "1205: a conjunction, no blood moon")
    setWorldDay(game, 4 * YEAR + WINTER + 1)
    assert.equal(game.api.getEvilGain(), before[3] * 1.5, "1204: a blood moon")
    assert.equal(mana.getXpGain(), before[0])
})

test("events that fall together multiply", async () => {
    const game = await loadEngine()
    const mana = game.api.getTaskById("mana_control")
    setWorldDay(game, 33 * YEAR + WINTER + 1) // 1233: Hard Winter and Arcane Conjunction
    const before = mana.getXpGain()
    unlock(game, "Shop", "Arcane glimpse")
    assert.deepEqual(ids(game.api.getActiveEvents()), ["hard_winter 1233", "arcane_conjunction 1233"])
    assert.equal(mana.getXpGain(), Math.round(before * 1.5 * 3))
})

test("the schedule keeps every life's start light and lands a Blood Moon after 1386", async () => {
    const game = await loadEngine()
    const winters = Array.from({ length: 57 }, (_, i) => game.api.getEventsOn(i * YEAR + WINTER).map(found => found.event.id))
    // No event in the first life's first two seasons
    assert.deepEqual(ids(game.api.getEventsInSpan(0, YEAR)), [])
    // The first life (1200 to 1256): Hard Winter and Arcane Conjunction meet once, late
    const both = winters.flatMap((found, i) => found.includes("hard_winter") && found.includes("arcane_conjunction") ? [1200 + i] : [])
    assert.deepEqual(both, [1233])
    // "Embrace evil" appears at 200, in Summer 1386; a Blood Moon follows that Winter, alone
    assert.deepEqual(ids(game.api.getEventsOn(186 * YEAR + WINTER)), ["blood_moon 1386"])
})
