// The cards on the left: purse, the current job and skill, the Almanac,
// happiness, evil, time warping and automation. Each part picks out what it
// shows, so it renders only when that changes.

import { useRef } from "react"
import type { Job, Skill } from "../game/classes.ts"
import { gameData } from "../game/state.ts"
import { items, skills } from "../game/data.ts"
import { getSourceEffect } from "../game/rules.ts"
import { getExpense, getHappiness, getIncome, getNet, getTaskById, isUnlocked,
    setAutoLearn, setAutoPromote, setTimeWarping } from "../game/engine.ts"
import { requestRender, sameData, shallowEqual, useGameValue } from "./gameStore.ts"
import { FormattedCoins } from "./CoinParts.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { classNames } from "./classNames.ts"
import { format, formatCoins } from "./format.ts"
import { useFillBar } from "./fillBar.ts"
import { Almanac } from "./Almanac.tsx"
import { getActiveEvents } from "../game/events.ts"
import { effectColor } from "./eventText.ts"

// onOpenChronicle: shows the Chronicle in the Settings tab
export function Sidebar({onOpenChronicle = () => {}}: {onOpenChronicle?: () => void}) {
    const quickTasksShown = useGameValue(() => isUnlocked("quick_task_display"))
    return (
        <aside className="sidebar">
            <Purse />
            <section id="quickTaskDisplay" className={classNames("card", !quickTasksShown && "hidden")}>
                <h2 className="card-label">Working on</h2>
                <QuickTask kind="Job" className="job" />
                <QuickTask kind="Skill" className="skill" />
            </section>
            <Almanac onOpenChronicle={onOpenChronicle} />
            <Stats />
        </aside>
    )
}

const signColors: Record<string, string> = {"+": "var(--pk-gain)", "-": "var(--pk-loss)", "": "var(--pk-text-muted)"}

function getPurse() {
    const income = getIncome()
    const expense = getExpense()
    return {
        coins: formatCoins(gameData.coins),
        net: formatCoins(getNet()),
        sign: income > expense ? "+" : expense > income ? "-" : "",
        income: formatCoins(income),
        expense: formatCoins(expense),
        job: gameData.currentJob.name,
        upkeep: [gameData.currentProperty, ...gameData.currentMisc].map(item => item.name).join(", "),
        // What events running do to pay and upkeep: "×1.25 upkeep from Hard Winter"
        events: getActiveEvents().flatMap(running => running.event.effects
            .filter(effect => effect.boosts.some(boost => boost.stat == "income" || boost.stat == "expense"))
            .map(effect => ({
                key: running.event.id + " " + effect.label,
                effect: "×" + Number(effect.effect.toFixed(2)),
                color: effectColor(effect),
                text: " " + effect.label + " from " + running.event.name,
            }))),
    }
}

function Purse() {
    const {coins, net, sign, income, expense, job, upkeep, events} = useGameValue(getPurse, sameData)
    return (
        <section className="card">
            <h2 className="card-label purse-label">Purse</h2>
            <div className="purse-main">
                <div className="purse-coins" id="coinDisplay"><FormattedCoins parts={coins} /></div>
                <div className="purse-net"><b id="signDisplay" style={{color: signColors[sign]}}>{sign}</b><b id="netDisplay"><FormattedCoins parts={net} /></b>a day</div>
            </div>
            <div className="card-note-list purse-notes">
                <span><span id="incomeDisplay"><FormattedCoins parts={income} /></span>earned from {job}</span>
                <span><span id="expenseDisplay"><FormattedCoins parts={expense} /></span>upkeep · {upkeep}</span>
                {events.map(event => (
                    <span key={event.key} className="purse-event">
                        <b style={{color: event.color}}>{event.effect}</b>{event.text}
                    </span>
                ))}
            </div>
        </section>
    )
}

function getStats() {
    // Time warping is a skill (data.ts)
    const timeWarping = getTaskById("time_warping") as Skill
    return {
        happinessShown: isUnlocked("happiness_info"),
        evilShown: isUnlocked("evil_info"),
        timeWarpingShown: isUnlocked("time_warping_info"),
        automationShown: isUnlocked("automation"),
        happiness: "×" + getHappiness().toFixed(1),
        happinessNote: getHappinessNote(),
        evil: gameData.evil.toFixed(1),
        glows: gameData.evil > 0,
        timeWarping: "×" + timeWarping.getEffect().toFixed(2),
        warping: gameData.timeWarpingEnabled,
        autoPromote: gameData.automation.autoPromote,
        autoLearn: gameData.automation.autoLearn,
    }
}

// Happiness, evil, time warping and automation
function Stats() {
    const stats = useGameValue(getStats, shallowEqual)
    const glows = stats.glows
    return (
        // Out of sight until something in it has been unlocked
        <section className={classNames("card card-stats", !(stats.happinessShown || stats.evilShown || stats.timeWarpingShown || stats.automationShown) && "hidden")}>
            <div id="happinessInfo" className={classNames("stat", !stats.happinessShown && "hidden")}>
                <span className="stat-line"><span className="stat-value" id="happinessDisplay">{stats.happiness}</span> <span className="stat-name stat-happiness">happiness</span></span>
                <span className="card-note">{stats.happinessNote}</span>
            </div>
            <div id="evilInfo" className={classNames("stat", !stats.evilShown && "hidden")}>
                {/* Once there is some evil, it smoulders (fx-anim: the effects setting can turn it off) */}
                <span className="stat-line"><span className={classNames("stat-value", glows && "evil-glow fx-anim")} id="evilDisplay">{stats.evil}</span> <span className={classNames("stat-name stat-evil", glows && "evil-glow fx-anim")}>evil</span></span>
                <span className="card-note">On dark magic XP</span>
            </div>
            <div id="timeWarping" className={classNames("stat", !stats.timeWarpingShown && "hidden")}>
                <span className="stat-line"><span className="stat-value" id="timeWarpingDisplay">{stats.timeWarping}</span> <span className="stat-name stat-time">time warping</span></span>
                <span className="card-note">On game speed</span>
                <button type="button" id="timeWarpingButton" className="w3-button button warp-button" onClick={() => {setTimeWarping(); requestRender()}}>
                    {stats.warping ? "Disable warp" : "Enable warp"}
                </button>
            </div>
            <div id="automation" className={classNames("automation", !stats.automationShown && "hidden")}>
                <h2 className="card-label">Automation</h2>
                <label className="automation-row">Auto-promote <Checkbox className="automation-check" id="autoPromote" checked={stats.autoPromote} onToggle={setAutoPromote} /></label>
                <label className="automation-row">Auto-learn <Checkbox className="automation-check" id="autoLearn" checked={stats.autoLearn} onToggle={setAutoLearn} /></label>
            </div>
        </section>
    )
}

// "On all XP · Cottage ×3.5, Meditation ×1.2": the property and every skill
// or item that boosts happiness, left out when it does nothing (×1)
function getHappinessNote(): string {
    const factors: [string, number][] = [[gameData.currentProperty.name, gameData.currentProperty.getEffect()]]
    for (const source of [...skills, ...items]) {
        if (source.boosts?.some(boost => boost.stat == "happiness")) factors.push([source.name, getSourceEffect(source)()])
    }
    const shown = factors.filter(([, effect]) => effect != 1).map(([name, effect]) => name + " ×" + Number(effect.toFixed(2)))
    return shown.length ? "On all XP · " + shown.join(", ") : "On all XP"
}

// How long the current job or skill needs for its next level, in game days
function getNextLevelText(task: Job | Skill): string {
    const gain = task.getXpGain()
    if (gain <= 0) return "paused"
    const days = Math.max(1, Math.ceil(task.getXpLeft() / gain))
    return "next level in " + format(days) + (days == 1 ? " day" : " days")
}

// The current job or skill: a bar with its level and progress, and a muted line under it
function QuickTask({kind, className}: {kind: "Job" | "Skill", className: string}) {
    const getTask = () => kind == "Job" ? gameData.currentJob : gameData.currentSkill
    const task = useGameValue(() => {
        const task = getTask()
        return {name: task.name, level: task.level, next: getNextLevelText(task)}
    }, shallowEqual)
    const fill = useRef<HTMLDivElement>(null)
    useFillBar(fill, () => getTask().xp / getTask().getMaxXp(), task.name)
    return (
        <div className="quick-task">
            <div className={classNames("quick-bar", className)}>
                <div ref={fill} className="quick-fill"></div>
                <div className="quick-text">
                    <span className="name">{task.name}</span>
                    <span className="quick-level">{"lvl " + task.level}</span>
                </div>
            </div>
            <span className="card-note">{kind + " · " + task.next}</span>
        </div>
    )
}
