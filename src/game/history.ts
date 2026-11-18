// The world's history: every life kept, and the one being lived, as spans of
// world days. The Chronicle and the past lives table read it. Every life
// wakes on the same day, so a life's span follows from its age. Lives are
// ordered by date, then by number, and lives whose spans overlap are given
// rows of their own.

import { gameData } from "./state.ts"
import type { LifeEnd } from "./state.ts"
import { getWorldDay, GROWING_UP_DAYS, toDate, WAKE_DAY, worldDayAt } from "./calendar.ts"
import { daysToYears } from "./rules.ts"
import { getFurthestDay } from "./engine.ts"

export interface LifeSpan {
    life: number // its number across the whole save
    born: number // world days
    woke: number // at 14
    ended: number // today for the life being lived
    living: boolean
    end: LifeEnd | null // null while living
    age: number // years at the end, or now
    evil: number // gained at the end
    row: number // 0, or more for a life that overlaps an earlier one
}

// The world day a past life ended, from the age it ended at
export function endedOn(life: {days: number}): number {
    return Math.max(WAKE_DAY, worldDayAt(life.days))
}

// The world day the next life wakes, whenever this one ends
export function nextWakeDay(): number {
    return WAKE_DAY
}

export function yearOf(worldDay: number): number {
    return toDate(worldDay).year
}

// "Winter 1296": the season and year a life reached
export function reachedText(worldDay: number): string {
    const date = toDate(worldDay)
    return date.season.name + " " + date.year
}

// The age in years a life is at on a world day
export function ageOn(worldDay: number): number {
    return daysToYears(worldDay - worldDayAt(0))
}

// The furthest date any life has reached, the age it was reached at, and
// the life that reached it first: a kept life, this one, or null once the
// life that set it has been dropped from the history. previous is the
// furthest the kept past lives reached, to say what this life has passed.
export interface WorldRecord {
    day: number
    age: number
    life: number | null
    living: boolean // this life holds it, ahead of every life kept
    previous: number | null // null with no past lives
}

export function getRecord(): WorldRecord {
    const day = getFurthestDay()
    const spans = getLifeSpans()
    const holder = spans.find(span => span.ended >= day)
    const past = spans.filter(span => !span.living)
    return {
        day: day,
        age: ageOn(day),
        life: holder ? holder.life : null,
        living: holder !== undefined && holder.living,
        previous: past.length ? Math.max(...past.map(span => span.ended)) : null,
    }
}

// Every life kept and the one being lived, earliest first
export function getLifeSpans(): LifeSpan[] {
    const spans: LifeSpan[] = gameData.lives.map(life => ({
        life: life.life,
        born: WAKE_DAY - GROWING_UP_DAYS,
        woke: WAKE_DAY,
        ended: endedOn(life),
        living: false,
        end: life.end,
        age: life.age,
        evil: life.evil,
        row: 0,
    }))
    spans.push({
        life: gameData.rebirthOneCount + gameData.rebirthTwoCount + 1,
        born: WAKE_DAY - GROWING_UP_DAYS,
        woke: WAKE_DAY,
        ended: getWorldDay(),
        living: true,
        end: null,
        age: daysToYears(gameData.days),
        evil: 0,
        row: 0,
    })
    spans.sort((a, b) => a.woke - b.woke || a.life - b.life)
    return assignRows(spans)
}

// Gives each span (earliest first) the first row free when it wakes
export function assignRows<T extends {woke: number, ended: number, row: number}>(spans: T[]): T[] {
    const rowEnds: number[] = []
    for (const span of spans) {
        let row = rowEnds.findIndex(end => end <= span.woke)
        if (row == -1) row = rowEnds.length
        rowEnds[row] = span.ended
        span.row = row
    }
    return spans
}

const numerals: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]]

// 14 -> "XIV". Lives are numbered from 1.
export function toRoman(number: number): string {
    let text = ""
    for (const [value, numeral] of numerals) {
        while (number >= value) {
            text += numeral
            number -= value
        }
    }
    return text
}
