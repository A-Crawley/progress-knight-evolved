// Era wording shared by the Jobs and Shop tables

import { gameData } from "../game/state.ts"
import { getEraRow } from "../game/eras.ts"
import type { Job, Item } from "../game/classes.ts"

// "Age of Guilds · opens 1300" for a category whose every row opens in a
// later era, so its header says why it's all locked; null otherwise
export function getCategoryEraHint(names: string[], data: Record<string, Job | Item>): string | null {
    const rows = names.map(name => getEraRow(data[name].baseData as Job["baseData"] | Item["baseData"], gameData.requirements[name].completed))
    const first = rows[0]
    if (!first || first.kind != "opens" || !rows.every(row => row.kind == "opens")) return null
    return first.era + " · opens " + first.year
}
