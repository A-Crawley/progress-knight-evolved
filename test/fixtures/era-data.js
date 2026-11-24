// Test-only game data for eras, played by loadEngine({data: withTestEra})
// (test/helpers/engine.js). None of it is in the real game.
//
// The Test age starts in 1230, so it is glimpsed once a life reaches 1210.

export const TEST_ERA_YEAR = 1230

export const testEra = {id: "test_age", name: "Test age", startYear: TEST_ERA_YEAR, description: "Only in tests."}

// A job added at the end of Common work, after Merchant
export const testPeddler = {id: "test_peddler", name: "Test peddler", category: "Common work", maxXp: 100, income: 7,
    requires: [{task: "beggar", level: 5}], tooltip: "Only in tests."}

// A category of the Test age, kept out of sight until a life reaches it
export const testGuildmaster = {id: "test_guildmaster", name: "Test guildmaster", category: "Test guild", maxXp: 100, income: 20,
    requires: [], tooltip: "Only in tests."}

export const testAgeGlimpse = {id: "test_age_glimpse", name: "Test age glimpse", reveals: ["Test guild"], permanent: true,
    requires: [{year: TEST_ERA_YEAR}]}

export function withTestEra(real) {
    return {
        eras: [...real.eras, testEra],
        jobs: [...real.jobs, testPeddler, testGuildmaster],
        unlocks: [...real.unlocks, testAgeGlimpse],
    }
}
