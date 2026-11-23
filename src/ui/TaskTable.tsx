// The Jobs and Skills tables: a header for each category, a row for each job
// or skill, and what the next one needs. Each row picks out what it shows, so
// it renders only when that changes.

import { Fragment } from "react"
import type { CSSProperties } from "react"
import { headerRowColors, idsByName, jobCategories, skillCategories, tooltips } from "../game/data.ts"
import { Job, Skill } from "../game/classes.ts"
import { setSkillSkipped, setTask } from "../game/engine.ts"
import { gameData } from "../game/state.ts"
import { requestRender, sameData, shallowEqual, useGameValue } from "./gameStore.ts"
import { EmptyCoinParts, FormattedCoins } from "./CoinParts.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { RequiredRow, isCategoryHidden, isCategoryUnseen } from "./RequiredRow.tsx"
import { classNames, removeSpaces } from "./classNames.ts"
import { format, formatCoins, splitEffect } from "./format.ts"
import { fillStyle } from "./fill.ts"
import { useLongPressTooltip } from "./useLongPressTooltip.ts"

export type TaskKind = "jobs" | "skills"

// Skill name -> skips or unskips it (one function per skill, so it stays the
// same between renders)
const skipSkill: Record<string, (skipped: boolean) => void> = {}
for (const name of Object.values(skillCategories).flat()) {
    skipSkill[name] = skipped => setSkillSkipped(name, skipped)
}

export function TaskTable({kind}: {kind: TaskKind}) {
    const categories = kind == "jobs" ? jobCategories : skillCategories
    return (
        <div className="table-scroll">
            <table id={kind == "jobs" ? "jobTable" : "skillTable"} className="w3-table w3-bordered task-table">
                <tbody>
                    {Object.entries(categories).map(([categoryName, names]) => (
                        <Fragment key={categoryName}>
                            <TaskHeaderRow kind={kind} categoryName={categoryName} />
                            {names.map(name => <TaskRow key={name} name={name} categoryName={categoryName} />)}
                            <RequiredRow categoryName={categoryName} category={names} items={false} />
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function TaskHeaderRow({kind, categoryName}: {kind: TaskKind, categoryName: string}) {
    const header = useGameValue(() => ({
        locked: isCategoryHidden(categoryName),
        unseen: isCategoryUnseen(categoryName),
        maxLevelShown: gameData.rebirthOneCount > 0,
        skipShown: kind == "skills" && gameData.automation.autoLearn,
    }), shallowEqual)
    return (
        <tr className={classNames(removeSpaces(categoryName), "headerRow", header.locked && "locked-header", header.unseen && "hidden")}
            style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
            <th className="category">{categoryName}</th>
            <th>Level</th>
            <th className="valueType">{kind == "jobs" ? "Income / day" : "Effect"}</th>
            <th>XP / day</th>
            <th>XP left</th>
            <th className={classNames("maxLevel", !header.maxLevelShown && "hidden")}>Max lvl</th>
            <th className="skipSkill" style={{display: header.skipShown ? "table-cell" : "none"}}>Skip</th>
        </tr>
    )
}

// Everything a row shows for a job or skill
function getRow(name: string, categoryName: string) {
    const task = gameData.taskData[name]
    const isSkill = task instanceof Skill
    const effect = isSkill ? splitEffect(task.getEffectDescription()) : null
    return {
        level: task.level,
        current: task == gameData.currentJob || task == gameData.currentSkill,
        share: task.xp / task.getMaxXp(),
        multiplier: effect?.multiplier ?? null,
        what: effect?.what ?? null,
        income: task instanceof Job ? formatCoins(task.getIncome()) : null,
        xpGain: format(task.getXpGain()),
        xpLeft: format(task.getXpLeft()),
        maxLevel: task.maxLevel,
        maxLevelShown: gameData.rebirthOneCount > 0,
        isSkill,
        skipShown: isSkill && gameData.automation.autoLearn,
        skipped: isSkill && gameData.automation.skippedSkills.has(idsByName[name]),
        // A locked or unseen category keeps its rows out of sight, whatever they need
        hidden: !gameData.requirements[name].completed || isCategoryHidden(categoryName) || isCategoryUnseen(categoryName),
    }
}

function TaskRow({name, categoryName}: {name: string, categoryName: string}) {
    const row = useGameValue(() => getRow(name, categoryName), sameData)
    const tooltipId = "tip-" + removeSpaces(name)
    const longPress = useLongPressTooltip()
    return (
        <tr id={"row " + name} className={classNames(row.hidden && "hidden")}
            style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
            <td>
                {/* A real button, so the keyboard can start the task too */}
                <button type="button" className={classNames("progress-bar progressBar tooltip", longPress.shown && "tooltip-open")} aria-describedby={tooltipId} {...longPress.handlers} onClick={() => {setTask(name); requestRender()}}>
                    {/* Keyed by level so a level-up resets the bar instead of sliding it back */}
                    {/* The track clips the sliding fill; the tooltip stays outside it */}
                    <span className="progress-track">
                        <span key={row.level} className={classNames("progress-fill progressFill", row.current && "current")}
                            style={fillStyle(row.share)}></span>
                    </span>
                    <span className="progress-text name">{name}</span>
                    <span className="bar-end">
                        {row.current && <span className="active-badge">Active</span>}
                        {/* Phones show the level inside the bar (hidden from 640px) */}
                        <span className="phone-level">{"lvl " + row.level}</span>
                    </span>
                    <span className="tooltipText" id={tooltipId} aria-hidden="true">{tooltips[name]}</span>
                </button>
            </td>
            <td className="level">{row.level}</td>
            <td className="value">
                <div className="effect">{row.multiplier !== null && <><strong>{row.multiplier}</strong> <span>{row.what}</span></>}</div>
                <div className="income">{row.income ? <FormattedCoins parts={row.income} /> : <EmptyCoinParts />}</div>
            </td>
            <td className="xpGain">{row.xpGain}</td>
            <td className="xpLeft">{row.xpLeft}</td>
            <td className={classNames("maxLevel", !row.maxLevelShown && "hidden")}>{row.maxLevel}</td>
            <td className="skipSkill" style={{display: row.skipShown ? "table-cell" : "none"}}>
                {" "}
                {/* The label makes the whole 44px cell on phones tap to toggle */}
                <label className="skip-label"><Checkbox className="checkbox" ariaLabel={"Skip " + name} checked={row.skipped}
                    onToggle={row.isSkill ? skipSkill[name] : undefined} /></label>
                {" "}
            </td>
        </tr>
    )
}
