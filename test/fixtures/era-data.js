// Test-only game data for eras, played by loadEngine({data: withTestEra})
// (test/helpers/engine.js). None of it is in the real game.
//
// The Test age starts in 1230, so it is glimpsed once a life reaches 1210.

export const TEST_ERA_YEAR = 1230

export const testEra = {id: "test_age", name: "Test age", startYear: TEST_ERA_YEAR, description: "Only in tests."}

// Two jobs added at the end of Common work, after Merchant: the Test
// trader closes in the Test age and passes to the Test guild trader
export const testTrader = {id: "test_trader", name: "Test trader", category: "Common work", maxXp: 100, income: 7,
    closesIn: TEST_ERA_YEAR, successor: "test_guild_trader", requires: [{task: "beggar", level: 5}], tooltip: "Only in tests."}
export const testGuildTrader = {id: "test_guild_trader", name: "Test guild trader", category: "Common work", maxXp: 100, income: 30,
    availableFrom: TEST_ERA_YEAR, requires: [{task: "test_trader", level: 10}], tooltip: "Only in tests."}

// Two misc items: the Test scroll closes in the Test age and passes to the
// Test ledger
export const testScroll = {id: "test_scroll", name: "Test scroll", category: "Misc", expense: 10, effect: 1.5, description: "Skill xp",
    boosts: [{stat: "xp", of: "skills"}], closesIn: TEST_ERA_YEAR, successor: "test_ledger", requires: [{coins: 0}], tooltip: "Only in tests."}
export const testLedger = {id: "test_ledger", name: "Test ledger", category: "Misc", expense: 20, effect: 2, description: "Skill xp",
    boosts: [{stat: "xp", of: "skills"}], availableFrom: TEST_ERA_YEAR, requires: [{coins: 0}], tooltip: "Only in tests."}

// A category of the Test age, kept out of sight until a life reaches it
export const testGuildmaster = {id: "test_guildmaster", name: "Test guildmaster", category: "Test guild", maxXp: 100, income: 20,
    requires: [], tooltip: "Only in tests."}

export const testAgeGlimpse = {id: "test_age_glimpse", name: "Test age glimpse", reveals: ["Test guild"], permanent: true,
    requires: [{year: TEST_ERA_YEAR}]}

export function withTestEra(real) {
    return {
        eras: [...real.eras, testEra],
        jobs: [...real.jobs, testTrader, testGuildTrader, testGuildmaster],
        items: [...real.items, testScroll, testLedger],
        unlocks: [...real.unlocks, testAgeGlimpse],
    }
}
