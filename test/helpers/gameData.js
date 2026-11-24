// Lets a test play on changed game data rather than the real game's. Call
// after vi.resetModules() and before importing the game's modules.

import path from "node:path"
import { vi } from "vitest"

const DATA_MODULE = path.join(import.meta.dirname, "..", "..", "src/game/data.ts")

// change(real) gets the real data module and returns the exports to replace,
// such as {jobs, items, unlocks, eras}. The lookup tables (namesById,
// jobCategories, ...) are rebuilt from the result. Without change, the next
// import is the real game's data.
function useGameData(change) {
    vi.doUnmock(DATA_MODULE)
    if (!change) return
    vi.doMock(DATA_MODULE, async importOriginal => {
        const real = await importOriginal()
        const changed = {...real, ...change(real)}
        return {...changed, ...real.deriveLookups(changed.jobs, changed.skills, changed.items, changed.unlocks)}
    })
}

export { useGameData }
