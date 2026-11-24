// Test-only game data for eras, played by loadEngine({data: withTestEra})
// (test/helpers/engine.js). None of it is in the real game.

// A job added at the end of Common work, after Merchant
export const testPeddler = {id: "test_peddler", name: "Test peddler", category: "Common work", maxXp: 100, income: 7,
    requires: [{task: "beggar", level: 5}], tooltip: "Only in tests."}

export function withTestEra(real) {
    return {
        jobs: [...real.jobs, testPeddler],
    }
}
