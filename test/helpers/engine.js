// Loads only the game logic (data, state, calendar, events, eras, rules, classes, engine
// and history) with no page: no document, no window, no timers. If any of these
// modules touched the page, loading or playing would throw.

import path from "node:path"
import { vi } from "vitest"
import { importModules, gameApi } from "./modules.js"

const ENGINE_MODULES = ["src/game/data.ts", "src/game/state.ts", "src/game/calendar.ts", "src/game/events.ts", "src/game/eras.ts", "src/game/rules.ts", "src/game/classes.ts", "src/game/engine.ts", "src/game/history.ts"]
const DATA_MODULE = path.join(import.meta.dirname, "..", "..", "src/game/data.ts")

// With options.data, the engine plays on changed game data rather than the
// real game's: data(real) gets the real data module and returns the exports
// to replace, such as {jobs, items, unlocks, eras}. The lookup tables
// (namesById, jobCategories, ...) are rebuilt from the result.
async function loadEngine(options = {}) {
    // In case a test in the same file loaded a page
    for (const name of ["window", "document", "localStorage", "location"]) delete globalThis[name]

    vi.resetModules()
    vi.doUnmock(DATA_MODULE)
    if (options.data) {
        const change = options.data
        vi.doMock(DATA_MODULE, async importOriginal => {
            const real = await importOriginal()
            const changed = {...real, ...change(real)}
            return {...changed, ...real.deriveLookups(changed.jobs, changed.skills, changed.items, changed.unlocks)}
        })
    }
    const api = gameApi(await importModules(ENGINE_MODULES))

    // Start a new game the way the page does: build the state, then run
    // one game step.
    api.initGameData()
    api.update()

    return {
        api,
        get gameData() { return api.gameData },
        fastTicks(count) {
            for (let i = 0; i < count; i++) api.update()
        },
    }
}

export { loadEngine }
