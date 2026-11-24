// The Jobs and Skills tables: a header for each category, a row for each job
// or skill, and what the next one needs. Each row picks out what it shows, so
// it renders only when that changes.

import { Fragment, memo, useRef } from "react"
import type { CSSProperties } from "react"
import { headerRowColors, idsByName, jobCategories, skillCategories, tooltips } from "../game/data.ts"
import { Job, Skill } from "../game/classes.ts"
import { getInheritedXpMultiplier, getPredecessor } from "../game/engine.ts"
import { selectTask, setSkillSkipped } from "./actions.ts"
import { getEraRow } from "../game/eras.ts"
import type { EraRow } from "../game/eras.ts"
import { gameData } from "../game/state.ts"
import { sameData, shallowEqual, useGameValue } from "./gameStore.ts"
import { EmptyCoinParts, FormattedCoins } from "./CoinParts.tsx"
import { Checkbox } from "./Checkbox.tsx"
import { RequiredRow, isCategoryHidden, isCategoryUnseen } from "./RequiredRow.tsx"
import { classNames, removeSpaces } from "./classNames.ts"
import { format, formatCoins, splitEffect } from "./format.ts"
import { useFillBar } from "./fillBar.ts"
import { useLongPressTooltip } from "./useLongPressTooltip.ts"
import { getCategoryEraHint } from "./eraText.ts"
import { EraIcon } from "./EraIcon.tsx"

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
                            <TaskHeaderRow kind={kind} categoryName={categoryName} names={names} />
                            {names.map(name => <TaskRow key={name} name={name} categoryName={categoryName} />)}
                            <RequiredRow categoryName={categoryName} category={names} items={false} />
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const TaskHeaderRow = memo(function TaskHeaderRow({kind, categoryName, names}: {kind: TaskKind, categoryName: string, names: string[]}) {
    const header = useGameValue(() => ({
        eraHint: kind == "jobs" ? getCategoryEraHint(names, gameData.taskData as Record<string, Job>) : null,
        locked: isCategoryHidden(categoryName),
        unseen: isCategoryUnseen(categoryName),
        maxLevelShown: gameData.rebirthOneCount > 0,
        skipShown: kind == "skills" && gameData.automation.autoLearn,
    }), shallowEqual)
    return (
        <tr className={classNames(removeSpaces(categoryName), "headerRow", header.locked && "locked-header", header.unseen && "hidden")}
            style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
            <th className="category">{categoryName}{header.eraHint && <span className="category-hint era-hint">{header.eraHint}</span>}</th>
            <th>Level</th>
            <th className="valueType">{kind == "jobs" ? "Income / day" : "Effect"}</th>
            <th>XP / day</th>
            <th>XP left</th>
            <th className={classNames("maxLevel", !header.maxLevelShown && "hidden")}>Max lvl</th>
            <th className="skipSkill" style={{display: header.skipShown ? "table-cell" : "none"}}>Skip</th>
        </tr>
    )
})

// What a job's tooltip adds to its description: the bonus a successor
// inherits from the job it replaced, "×4.2 XP from Merchant"
function getInheritedText(task: Job | Skill): string | null {
    if (!(task instanceof Job)) return null
    const predecessor = getPredecessor(task)
    const multiplier = getInheritedXpMultiplier(task)
    if (!predecessor || multiplier <= 1) return null
    return "×" + Number(multiplier.toFixed(2)) + " XP from " + predecessor.name
}

// Everything a row shows for a job or skill
function getRow(name: string, categoryName: string) {
    const task = gameData.taskData[name]
    const isSkill = task instanceof Skill
    const effect = isSkill ? splitEffect(task.getEffectDescription()) : null
    const unlocked = gameData.requirements[name].completed
    const era: EraRow = task instanceof Job ? getEraRow(task.baseData, unlocked) : {kind: "open", closesIn: null}
    const categoryShown = !isCategoryHidden(categoryName) && !isCategoryUnseen(categoryName)
    return {
        era,
        inherited: getInheritedText(task),
        level: task.level,
        current: task == gameData.currentJob || task == gameData.currentSkill,
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
        // A locked or unseen category keeps its rows out of sight, whatever they
        // need. A row opening in a later era shows locked once any life has
        // reached it; a closed one shows if this life unlocked it.
        hidden: !categoryShown || era.kind == "unseen" || (era.kind == "open" && !unlocked),
    }
}

const TaskRow = memo(function TaskRow({name, categoryName}: {name: string, categoryName: string}) {
    const row = useGameValue(() => getRow(name, categoryName), sameData)
    const fill = useRef<HTMLSpanElement>(null)
    useFillBar(fill, () => gameData.taskData[name].xp / gameData.taskData[name].getMaxXp())
    const tooltipId = "tip-" + removeSpaces(name)
    const longPress = useLongPressTooltip()
    return (
        <tr id={"row " + name} className={classNames(row.hidden && "hidden")}
            style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
            <td>
                {row.era.kind == "closed" && <ClosedBar name={name} era={row.era} />}
                {row.era.kind == "opens" && <OpensBar name={name} year={row.era.year} />}
                {row.era.kind == "open" && <>
                {/* A real button, so the keyboard can start the task too */}
                <button type="button" className={classNames("progress-bar progressBar tooltip", longPress.shown && "tooltip-open")} aria-describedby={tooltipId} {...longPress.handlers} onClick={() => selectTask(name)}>
                    {/* The track clips the sliding fill; the tooltip stays outside it */}
                    <span className="progress-track">
                        <span ref={fill} className={classNames("progress-fill progressFill", row.current && "current")}></span>
                    </span>
                    <span className="progress-text name">{name}</span>
                    <span className="bar-end">
                        {row.era.closesIn !== null && <span className="closes-hint">{"Closes in " + row.era.closesIn}</span>}
                        {row.current && <span className="active-badge">Active</span>}
                        {/* Phones show the level inside the bar (hidden from 640px) */}
                        <span className="phone-level">{"lvl " + row.level}</span>
                    </span>
                    <span className="tooltipText" id={tooltipId} aria-hidden="true">
                        {tooltips[name]}
                        {row.inherited && <span className="tooltip-source">{row.inherited}</span>}
                    </span>
                </button>
                </>}
            </td>
            <td className="level">{row.era.kind != "opens" && row.level}</td>
            <td className="value">
                <div className="effect">{row.multiplier !== null && <><strong>{row.multiplier}</strong> <span>{row.what}</span></>}</div>
                <div className="income">{row.income && row.era.kind == "open" ? <FormattedCoins parts={row.income} /> : row.era.kind == "closed" ? "—" : <EmptyCoinParts />}</div>
            </td>
            <td className="xpGain">{row.era.kind == "open" ? row.xpGain : row.era.kind == "closed" ? "—" : ""}</td>
            <td className="xpLeft">{row.era.kind == "open" ? row.xpLeft : row.era.kind == "closed" ? "—" : ""}</td>
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
})

// A job or item closed by an era: muted, with what took its place
export function ClosedBar({name, era}: {name: string, era: Extract<EraRow, {kind: "closed"}>}) {
    return (
        <div className="era-bar era-closed">
            <span className="name">{name}</span>
            {" "}
            <span className="era-closed-note">
                {"Closed in " + era.year}
                {era.successor && <>{" · became "}<a href={"#" + encodeURIComponent("row " + era.successor)}>{era.successor + " →"}</a></>}
            </span>
        </div>
    )
}

// A job or item of a later era that some life has reached: locked until
// that year
export function OpensBar({name, year}: {name: string, year: number}) {
    return (
        <div className="era-bar era-opens">
            <EraIcon />
            <span className="name">{name}</span>
            {" "}
            <span className="era-opens-note">{"Opens in " + year}</span>
        </div>
    )
}
