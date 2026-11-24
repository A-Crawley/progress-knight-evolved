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
    assert.ok("Test trader" in testGame.gameData.taskData)
    assert.equal(testGame.api.namesById.test_trader, "Test trader")
    assert.equal(testGame.api.jobCategories["Common work"].at(-1), "Test guild trader")
    assert.ok(testGame.api.gameData.requirements["Test trader"])

    const realGame = await loadEngine()
    assert.equal("Test trader" in realGame.gameData.taskData, false)
    assert.equal(realGame.api.namesById.test_trader, undefined)
})

// The world day a year starts on
const startOf = year => (year - 1200) * DAYS_PER_YEAR

test("getEra names the era a year is in: the Age of Fiefs, then the Age of Guilds from 1300", async () => {
    const { api } = await loadEngine()
    assert.equal(api.getEra(1199), undefined)
    assert.equal(api.getEra(1200).name, "Age of Fiefs")
    assert.equal(api.getEra(1299).name, "Age of Fiefs")
    assert.equal(api.getEra(1300).name, "Age of Guilds")
    assert.equal(api.getNextEra(1200).name, "Age of Guilds")
    assert.equal(api.getGlimpsedEra(), undefined, "nothing is glimpsed in a new game")
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

// ---------------------------------------------------------------------------
// Closing jobs and items

// A game on the test data, in the last days of 1229, working as a Test
// trader (level 32 unless given) with the Test scroll in use
async function traderIn1229(traderLevel = 32) {
    const game = await loadEngine({data: withTestEra})
    const { api, gameData } = game
    gameData.taskData["Beggar"].level = 10
    gameData.taskData["Farmer"].level = 3
    gameData.taskData["Test trader"].level = traderLevel
    game.fastTicks(1)
    api.setTask("Test trader")
    api.setMisc("Test scroll")
    goToYear(gameData, 1230)
    gameData.days -= 2
    return game
}

const job = game => game.gameData.currentJob.name
const misc = game => game.gameData.currentMisc.map(item => item.name)

test("a closing job passes to its successor once that is unlocked", async () => {
    const game = await traderIn1229()
    game.fastTicks(1)
    assert.equal(job(game), "Test trader")

    game.gameData.days += 2
    game.fastTicks(1)
    assert.equal(game.api.getWorldYear(), 1230)
    assert.equal(job(game), "Test guild trader")
    // Its levels are kept, and still count for requirements
    assert.equal(game.gameData.taskData["Test trader"].level, 32)
    assert.equal(game.gameData.requirements["Test guild trader"].isCompleted(), true)
})

test("without its successor unlocked, a closing job passes to the highest open job in its category", async () => {
    // The Test guild trader needs Test trader 10; the Farmer (Beggar 10) is unlocked
    const game = await traderIn1229(2)
    game.gameData.days += 2
    game.fastTicks(1)
    assert.equal(job(game), "Farmer")
})

test("a closed job can't be started again in that life, and a job whose era hasn't come can't be started early", async () => {
    const game = await traderIn1229()
    const { api } = game
    api.setTask("Test guild trader")
    assert.equal(job(game), "Test trader")

    game.gameData.days += 2
    game.fastTicks(1)
    api.setTask("Beggar")
    api.setTask("Test trader")
    assert.equal(job(game), "Beggar")
    assert.equal(api.isClosed(game.gameData.taskData["Test trader"].baseData), true)
})

test("an active item switches off when it closes, its upkeep stops, and it can't be bought again", async () => {
    const game = await traderIn1229()
    const { api } = game
    assert.deepEqual(misc(game), ["Test scroll"])
    assert.ok(api.getExpense() > 0)
    // Its successor can't be bought before its era
    api.setMisc("Test ledger")
    assert.deepEqual(misc(game), ["Test scroll"])

    game.gameData.days += 2
    game.fastTicks(1)
    assert.deepEqual(misc(game), [])
    assert.equal(api.getExpense(), game.gameData.currentProperty.getExpense())

    api.setMisc("Test scroll")
    assert.deepEqual(misc(game), [])
    api.setMisc("Test ledger")
    assert.deepEqual(misc(game), ["Test ledger"])
})

test("the successor learns faster by 1 + its predecessor's highest level / 10", async () => {
    const game = await traderIn1229()
    const { api, gameData } = game
    const guildTrader = gameData.taskData["Test guild trader"]
    assert.equal(api.getInheritedXpMultiplier(guildTrader), 4.2)
    assert.equal(api.getInheritedXpMultiplier(gameData.taskData["Farmer"]), 1)

    const withBonus = guildTrader.getXpGain()
    gameData.taskData["Test trader"].level = 0
    assert.equal(api.getInheritedXpMultiplier(guildTrader), 1)
    assert.ok(Math.abs(withBonus / guildTrader.getXpGain() - 4.2) < 0.05)

    // A max level from an earlier life counts too
    gameData.taskData["Test trader"].maxLevel = 50
    assert.equal(api.getInheritedXpMultiplier(guildTrader), 6)
})

test("auto-promote follows a closed job to its successor, and waits for a job whose era hasn't come", async () => {
    const game = await traderIn1229()
    const { api, gameData } = game
    api.setAutoPromote(true)

    // Before 1230 the next job, the Test guild trader, hasn't opened
    game.fastTicks(1)
    assert.equal(job(game), "Test trader")

    // From Merchant, the next job is the closed Test trader: follow it on
    game.gameData.days += 2
    gameData.taskData["Merchant"].level = 1
    gameData.currentJob = gameData.taskData["Merchant"]
    game.fastTicks(1)
    assert.equal(job(game), "Test guild trader")
})

test("a rebirth reopens everything", async () => {
    const game = await traderIn1229()
    const { api, gameData } = game
    game.gameData.days += 2
    game.fastTicks(1)
    assert.equal(api.isOpen(gameData.taskData["Test trader"].baseData), false)
    assert.equal(api.isOpen(gameData.itemData["Test scroll"].baseData), false)

    api.rebirthOne()
    game.fastTicks(1)
    assert.equal(api.getWorldYear(), 1200)
    assert.equal(api.isOpen(gameData.taskData["Test trader"].baseData), true)
    assert.equal(api.isOpen(gameData.itemData["Test scroll"].baseData), true)
    assert.equal(api.isOpen(gameData.taskData["Test guild trader"].baseData), false)
    // The max level is kept as usual, so the successor's bonus carries over
    assert.equal(gameData.taskData["Test trader"].maxLevel, 32)
    assert.equal(api.getInheritedXpMultiplier(gameData.taskData["Test guild trader"]), 4.2)
})

test("a job that closes in the save's year is moved on when the save is loaded and played", async () => {
    const game = await traderIn1229()
    const { gameData } = game
    // As if a save had the closed job as the current one
    gameData.days += 2
    gameData.currentJob = gameData.taskData["Test trader"]
    game.fastTicks(1)
    assert.equal(job(game), "Test guild trader")
})

test("mistakes in the era fields fail when the game starts", async () => {
    const withData = change => loadEngine({data: real => ({...withTestEra(real), ...change(real)})})
    const jobsWith = (real, changes) => ({jobs: [...withTestEra(real).jobs.map(job => changes[job.id] ? {...job, ...changes[job.id]} : job)]})

    await assert.rejects(withData(real => jobsWith(real, {test_guild_trader: {availableFrom: 1231}})), /must open in 1230/)
    await assert.rejects(withData(real => jobsWith(real, {test_trader: {successor: "nobody"}})), /isn't a job/)
    await assert.rejects(withData(real => jobsWith(real, {beggar: {successor: "farmer"}})), /never closes/)
    await assert.rejects(withData(real => ({items: real.items.map(item => item.id == "tent" ? {...item, closesIn: 1230} : item)})), /properties never close/)
    await assert.rejects(withData(real => ({skills: real.skills.map(skill => skill.id == "strength" ? {...skill, closesIn: 1230} : skill)})), /skills never close/)
})

// ---------------------------------------------------------------------------
// What the page shows about eras

test("the banner shows for the era this life is in, never the first, until dismissed for the rest of the life", async () => {
    const game = await loadEngine({data: withTestEra})
    const { api, gameData } = game
    assert.equal(api.getEraBanner(), undefined)

    goToYear(gameData, 1230)
    game.fastTicks(1)
    assert.equal(api.getEraBanner().id, "test_age")
    api.dismissEraBanner("test_age")
    api.dismissEraBanner("test_age")
    assert.deepEqual(Array.from(gameData.eraBannersDismissed), ["test_age"])
    assert.equal(api.getEraBanner(), undefined)

    // The next life that reaches it sees it again
    api.rebirthOne()
    assert.deepEqual(Array.from(gameData.eraBannersDismissed), [])
    goToYear(gameData, 1230)
    assert.equal(api.getEraBanner().id, "test_age")
})

test("an era is new for its first 30 days; the first era never is", async () => {
    const { api } = await loadEngine({data: withTestEra})
    assert.equal(api.isEraNew(0), false)
    assert.equal(api.isEraNew(startOf(1230) - 1), false)
    assert.equal(api.isEraNew(startOf(1230)), true)
    assert.equal(api.isEraNew(startOf(1230) + 29.9), true)
    assert.equal(api.isEraNew(startOf(1230) + 30), false)
})

test("the last job closing is remembered for this life, with where you moved to", async () => {
    const game = await traderIn1229(2)
    const { api, gameData } = game
    assert.equal(gameData.lastClosing, null)
    game.gameData.days += 2
    game.fastTicks(1)
    assert.deepEqual({...gameData.lastClosing, day: Math.floor(gameData.lastClosing.day)},
        {from: "Test trader", to: "Farmer", year: 1230, day: startOf(1230)})

    api.rebirthOne()
    assert.equal(gameData.lastClosing, null)
})

// ---------------------------------------------------------------------------
// An era's events

const fair = api => api.events.find(event => event.id == "test_fair")

test("an era's event only comes round from its first year and before its last", async () => {
    const { api } = await loadEngine({data: withTestEra})
    assert.deepEqual([1228, 1229, 1230, 1231, 1232, 1238, 1240, 1242].map(year => api.happensIn(fair(api), year)),
        [false, false, true, false, true, true, false, false])
})

test("an era's event stays out of sight until some life has reached its first year", async () => {
    const { api, gameData } = await loadEngine({data: withTestEra})
    assert.equal(api.isEventUnlocked(fair(api)), false)
    assert.ok(!api.getUpcomingEvents(0, 20).some(found => found.event.id == "test_fair"))

    gameData.furthestDay = startOf(1230)
    assert.equal(api.isEventUnlocked(fair(api)), true)
    assert.equal(api.getUpcomingEvents(0, 40).filter(found => found.event.id == "test_fair")[0].year, 1230)
})

test("an era's event works while it runs: the Test fair doubles Common work pay in Summer 1230", async () => {
    const game = await loadEngine({data: withTestEra})
    const { gameData } = game
    const beggar = gameData.taskData["Beggar"]
    goToYear(gameData, 1229)
    game.fastTicks(1)
    const before = beggar.getIncome()
    goToYear(gameData, 1230)
    game.fastTicks(1)
    assert.equal(beggar.getIncome(), before * 2)
})

// ---------------------------------------------------------------------------
// The Age of Guilds (the real game's first later era)

// 1300 is age 114, past the natural 70: Immortality 200 gives about 176
function liveLong(gameData) {
    gameData.taskData["Immortality"].level = 200
}

test("in 1300 Merchant closes and passes to Guild merchant, carrying its level as an XP bonus", async () => {
    const game = await loadEngine()
    const { api, gameData } = game
    liveLong(gameData)
    gameData.taskData["Bargaining"].level = 50
    gameData.taskData["Blacksmith"].level = 10
    gameData.taskData["Merchant"].level = 32
    game.fastTicks(1)
    api.setTask("Merchant")
    api.setTask("Guild merchant")
    assert.equal(gameData.currentJob.name, "Merchant", "Guild merchant hasn't opened yet")

    goToYear(gameData, 1300)
    game.fastTicks(1)
    assert.equal(gameData.currentJob.name, "Guild merchant")
    assert.equal(api.getInheritedXpMultiplier(gameData.taskData["Guild merchant"]), 4.2)
    assert.equal(api.getEraBanner().name, "Age of Guilds")
})

test("Banker and Knight-commander open in 1300, each behind its own requirements", async () => {
    const game = await loadEngine()
    const { api, gameData } = game
    liveLong(gameData)
    for (const [name, level] of [["Guild merchant", 10], ["Accounting", 50], ["Battle tactics", 300], ["Elite knight", 10]]) {
        gameData.taskData[name].level = level
    }
    game.fastTicks(1)
    api.setTask("Banker")
    api.setTask("Knight-commander")
    assert.equal(gameData.currentJob.name, "Beggar", "neither opens before 1300")

    goToYear(gameData, 1300)
    game.fastTicks(1)
    api.setTask("Banker")
    assert.equal(gameData.currentJob.name, "Banker")
    api.setTask("Knight-commander")
    assert.equal(gameData.currentJob.name, "Knight-commander")
    // Knight-commander comes straight after Elite knight
    const military = api.jobCategories["Military"]
    assert.equal(military[military.indexOf("Elite knight") + 1], "Knight-commander")
})

test("Letters stays out of sight until a life reaches 1300, opens then, and shows locked in later lives", async () => {
    const game = await loadEngine()
    const { api, gameData } = game
    liveLong(gameData)
    api.setAutoLearn(true)
    game.fastTicks(5)
    assert.equal(api.isUnlocked("guilds_glimpse"), false)
    assert.equal(api.isUnlocked("letters"), false)
    assert.equal(gameData.requirements["Literacy"].isCompleted(), false)
    assert.notEqual(gameData.currentSkill.name, "Literacy", "auto-learn can't pick a Letters skill early")

    goToYear(gameData, 1300)
    game.fastTicks(1)
    assert.equal(api.isUnlocked("letters"), true)
    assert.equal(gameData.requirements["Literacy"].isCompleted(), true)

    api.rebirthOne()
    game.fastTicks(1)
    assert.equal(api.isUnlocked("guilds_glimpse"), true, "revealed for good")
    assert.equal(api.isUnlocked("letters"), false, "but locked again until 1300")
    assert.equal(gameData.requirements["Literacy"].isCompleted(), false)
})
