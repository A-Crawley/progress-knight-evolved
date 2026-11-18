// A bot that plays Progress Knight the way a good player would, using the
// game's own engine and nothing else: no page, no timers. tools/bot/run.ts
// plays it life after life and reports how far each life got; the tests use
// it to check that the game can still be played past its walls.
//
// The route, which is what gets past Immortality's wall (Apprentice mage 10
// needs Mana control 400, out of reach on a Merchant's happiness):
//
// - Spend up to 90% of income on the best property, then misc items.
// - Level every skill evenly: always the unlocked skill with the lowest level.
// - Jobs: the best Common job until Squire opens, then up the Military line
//   to Elite knight. Only with Elite knight reached in this life, the Arcane
//   Association: each Arcane job up to the level the next one needs, and
//   otherwise whichever unlocked job pays most right now.
// - At the end of a life, embrace evil if it reached 200, else touch the eye.

import { itemCategories, jobs, namesById, skills } from "../../src/game/data.ts"
import { gameData } from "../../src/game/state.ts"
import { getIncome, isUnlocked, rebirthOne, rebirthTwo, update } from "../../src/game/engine.ts"
import { applyStatBoosts, getLifespan, isAlive, updateSpeed } from "../../src/game/rules.ts"
import type { Job, Skill } from "../../src/game/classes.ts"
import type { JobDefinition } from "../../src/game/types.ts"

// Share of income spent on property and misc items
const BUDGET = 0.9

// How often, in game steps, the bot shops and picks its job and skill
const SHOP_EVERY = 100
const CHOOSE_EVERY = 20

const ARCANE = "The Arcane Association"

function unlocked(name: string): boolean {
    return gameData.requirements[name].isCompleted()
}

function task(definition: JobDefinition): Job {
    return gameData.taskData[definition.name] as Job
}

// A job or skill's level this life, by id
export function levelOf(id: string): number {
    return gameData.taskData[namesById[id]]?.level ?? 0
}

// The best property within budget, then every misc item that still fits
export function shop(): void {
    const budget = getIncome() * BUDGET
    let property = gameData.itemData["Homeless"]
    for (const name of itemCategories["Properties"]) {
        const item = gameData.itemData[name]
        if (unlocked(name) && item.getExpense() <= budget && item.getExpense() >= property.getExpense()) property = item
    }
    gameData.currentProperty = property
    gameData.currentMisc = []
    let spent = property.getExpense()
    for (const name of itemCategories["Misc"]) {
        const item = gameData.itemData[name]
        if (unlocked(name) && spent + item.getExpense() <= budget) {
            gameData.currentMisc.push(item)
            spent += item.getExpense()
        }
    }
}

// The highest unlocked job in a category, or null
function topOf(category: string): Job | null {
    let top: Job | null = null
    for (const job of jobs) {
        if (job.category == category && unlocked(job.name)) top = task(job)
    }
    return top
}

export function chooseJob(): void {
    if (!unlocked("Elite knight")) {
        gameData.currentJob = topOf("Military") ?? topOf("Common work") ?? gameData.currentJob
        return
    }
    // An Arcane job the next one is waiting on
    const arcane = jobs.filter(job => job.category == ARCANE)
    for (let i = 0; i < arcane.length - 1; i++) {
        const current = arcane[i], next = arcane[i + 1]
        if (!unlocked(current.name) || unlocked(next.name)) continue
        const waiting = next.requires.some(spec => spec.task == current.id && task(current).level < spec.level)
        if (waiting) {
            gameData.currentJob = task(current)
            return
        }
    }
    let best = gameData.currentJob
    for (const job of jobs) {
        if (unlocked(job.name) && task(job).getIncome() > best.getIncome()) best = task(job)
    }
    gameData.currentJob = best
}

export function chooseSkill(): void {
    let lowest: Skill | null = null
    for (const skill of skills) {
        const candidate = gameData.taskData[skill.name] as Skill
        if (unlocked(skill.name) && (!lowest || candidate.level < lowest.level)) lowest = candidate
    }
    if (lowest) gameData.currentSkill = lowest
}

// One game step, choosing first when it's time to
export function step(steps: number): void {
    if (steps % SHOP_EVERY == 0) shop()
    if (steps % CHOOSE_EVERY == 0) {
        chooseJob()
        chooseSkill()
    }
    update()
}

export interface LifeReport {
    life: number
    lifespan: number // years
    age: number // years, at the end
    year: number // the year the life reached
    steps: number
    seconds: number // real time, with time warping as the bot played
    secondsWithoutWarping: number
    warping: number // the time warping speed at the end
    evil: number // held while this life was lived
    immortality: number
    superImmortality: number
    timeWarping: number
    manaControl: number
    masterWizard: number
    chairman: number
    job: string
    ended: "evil" | "rebirth"
}

// Embracing evil resets every max level, so after the first time a life
// reaches 200 the bot plays rebuild lives (touching the eye) for as long as
// each one outlives the last by at least this share, and embraces evil only
// once lifespan has levelled off
const REBUILD_GAIN = 0.01

// The lifespan of the last life, for rebuild lives to compare against
let lastLifespan = 0

function shouldEmbraceEvil(lifespan: number): boolean {
    if (!isUnlocked("rebirth_note_3")) return false
    if (gameData.evil == 0) return true
    return lifespan < lastLifespan * (1 + REBUILD_GAIN)
}

// Plays the life being lived to its end, then ends it: in evil if it reached
// 200 and rebuilding has levelled off, else by touching the eye. A life is
// cut short after maxSteps.
export function playLife(maxSteps = Infinity): LifeReport {
    gameData.timeWarpingEnabled = true
    const life = gameData.rebirthOneCount + gameData.rebirthTwoCount + 1
    const evil = gameData.evil
    let steps = 0
    while (isAlive() && steps < maxSteps) {
        step(steps)
        steps++
    }
    const age = gameData.days / 365
    const lifespan = getLifespan() / 365
    const ended = shouldEmbraceEvil(lifespan) ? "evil" : "rebirth"
    lastLifespan = ended == "evil" ? 0 : lifespan
    const report: LifeReport = {
        life,
        lifespan,
        age,
        year: Math.floor(1200 + age - 14),
        steps,
        seconds: steps / updateSpeed,
        // The game runs 4 days a second before time warping
        secondsWithoutWarping: (age - 14) * 365 / 4,
        warping: applyStatBoosts("gameSpeed", 1),
        evil,
        immortality: levelOf("immortality"),
        superImmortality: levelOf("super_immortality"),
        timeWarping: levelOf("time_warping"),
        manaControl: levelOf("mana_control"),
        masterWizard: levelOf("master_wizard"),
        chairman: levelOf("chairman"),
        job: gameData.currentJob.name,
        ended,
    }
    if (ended == "evil") rebirthTwo()
    else rebirthOne()
    return report
}
