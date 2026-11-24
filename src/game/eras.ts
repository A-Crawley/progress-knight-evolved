// Eras on the world calendar (data.ts): which era a year is in, which eras
// any life has reached, and which one is glimpsed ahead. Nothing about eras
// is stored; it all follows from the date and the furthest date any life
// has reached (gameData.furthestDay).

import { eras } from "./data.ts"
import { gameData } from "./state.ts"
import { getWorldDay, seasonStart, DAYS_PER_YEAR } from "./calendar.ts"
import type { EraDefinition } from "./types.ts"

// How close the record has to come to the next era for it to be glimpsed
export const ERA_GLIMPSE_YEARS = 20

// The era a world year is in, or undefined before the first one
export function getEra(year: number): EraDefinition | undefined {
    let found: EraDefinition | undefined
    for (const era of eras) {
        if (era.startYear <= year) found = era
    }
    return found
}

// The first era that starts after a world year, if any
export function getNextEra(year: number): EraDefinition | undefined {
    return eras.find(era => era.startYear > year)
}

// The world day an era starts on: the first day of its start year
export function eraStartDay(era: EraDefinition): number {
    return seasonStart(era.startYear, 0)
}

// The furthest world day any life has reached, counting today
function getRecordDay(): number {
    return Math.max(gameData.furthestDay, getWorldDay())
}

// Whether any life, this one included, has reached the era
export function isEraReached(era: EraDefinition): boolean {
    return getRecordDay() >= eraStartDay(era)
}

// The first era no life has reached, once the record is within
// ERA_GLIMPSE_YEARS of it. Undefined until then, and when every era has
// been reached.
export function getGlimpsedEra(): EraDefinition | undefined {
    const next = eras.find(era => !isEraReached(era))
    if (!next) return undefined
    return getRecordDay() >= eraStartDay(next) - ERA_GLIMPSE_YEARS * DAYS_PER_YEAR ? next : undefined
}
