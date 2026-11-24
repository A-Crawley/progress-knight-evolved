// Test-only game data for eras, played by loadEngine({data: withTestEra})
// (test/helpers/engine.js). None of it is in the real game.
//
// The Test age starts in 1230, so it is glimpsed once a life reaches 1210.
// The real game's later eras and their content are left out, so the tests
// of how eras work don't depend on what the real eras hold.

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
    availableFrom: TEST_ERA_YEAR, requires: [], tooltip: "Only in tests."}

export const testAgeGlimpse = {id: "test_age_glimpse", name: "Test age glimpse", reveals: ["Test guild"], permanent: true,
    requires: [{year: TEST_ERA_YEAR}]}

// An event of the Test age: every other Summer from 1230, until 1240
export const testFair = {id: "test_fair", name: "Test fair", plural: "Test fairs", season: "summer", everyYears: 2, offset: 0,
    from: TEST_ERA_YEAR, until: TEST_ERA_YEAR + 10,
    effects: [{label: "Common work pay", effect: 2, boosts: [{stat: "income", of: "Common work"}]}],
    description: "Only in tests."}

// The real definitions as they were before any later era: nothing that
// opens later, nothing that closes, and no later era's unlocks or events
function withoutLaterEras(definitions) {
    return definitions.filter(definition => definition.availableFrom === undefined).map(definition => {
        // eslint-disable-next-line no-unused-vars
        const {closesIn, successor, ...kept} = definition
        return kept
    })
}

function isLaterEra(definition) {
    return (definition.requires ?? []).some(spec => "year" in spec)
}

export function withTestEra(real) {
    return {
        eras: [real.eras[0], testEra],
        jobs: [...withoutLaterEras(real.jobs), testTrader, testGuildTrader, testGuildmaster],
        skills: real.skills.filter(skill => !isLaterEra(skill) && real.skills.every(other => !isLaterEra(other)
            || !skill.requires.some(spec => spec.task == other.id))),
        items: [...withoutLaterEras(real.items), testScroll, testLedger],
        unlocks: [...real.unlocks.filter(unlock => !isLaterEra(unlock)), testAgeGlimpse],
        events: [...real.events.filter(event => event.from === undefined), testFair],
    }
}
