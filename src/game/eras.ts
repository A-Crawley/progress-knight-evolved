// Eras on the world calendar (data.ts): which era a year is in, which eras
// any life has reached, and which one is glimpsed ahead. Nothing about eras
// is stored; it all follows from the date and the furthest date any life
// has reached (gameData.furthestDay).

import { eras, jobs, skills, items } from "./data.ts"
import { gameData } from "./state.ts"
import { getWorldDay, getWorldYear, seasonStart, DAYS_PER_YEAR } from "./calendar.ts"
import type { EraDefinition, JobDefinition, ItemDefinition } from "./types.ts"

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

// ---------------------------------------------------------------------------
// Jobs and items that open and close with eras (availableFrom, closesIn and
// successor in types.ts). Skills never close, and neither do properties.

// Whether it has closed for the rest of this life
export function isClosed(definition: JobDefinition | ItemDefinition): boolean {
    return definition.closesIn !== undefined && getWorldYear() >= definition.closesIn
}

// Whether its era hasn't come yet in this life
export function isNotYetOpen(definition: JobDefinition | ItemDefinition): boolean {
    return definition.availableFrom !== undefined && getWorldYear() < definition.availableFrom
}

// Whether it can be used in the year this life is in. Its own unlock
// requirement still applies on top.
export function isOpen(definition: JobDefinition | ItemDefinition): boolean {
    return !isClosed(definition) && !isNotYetOpen(definition)
}

// Checks the era fields of every job and item, so a mistake in the data
// fails when the game starts rather than in play
export function checkEraFields(): void {
    const check = (definitions: readonly (JobDefinition | ItemDefinition)[], kind: string) => {
        for (const definition of definitions) {
            const {availableFrom, closesIn, successor} = definition
            if ("category" in definition && definition.category == "Properties" && closesIn !== undefined) {
                throw new Error(definition.name + ": properties never close")
            }
            if (successor !== undefined && closesIn === undefined) throw new Error(definition.name + " has a successor but never closes")
            if (availableFrom !== undefined && closesIn !== undefined && closesIn <= availableFrom) {
                throw new Error(definition.name + " closes before it opens")
            }
            if (successor === undefined) continue
            const next = definitions.find(other => other.id == successor)
            if (!next) throw new Error(definition.name + "'s successor " + successor + " isn't a " + kind)
            if (next.availableFrom !== closesIn) throw new Error(next.name + " must open in " + closesIn + ", when " + definition.name + " closes")
        }
    }
    check(jobs, "job")
    check(items, "item")
    for (const skill of skills) {
        if ("closesIn" in skill) throw new Error(skill.name + ": skills never close")
    }
}
