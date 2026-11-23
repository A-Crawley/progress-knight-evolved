// The Amulet tab's history: one row per past life and a last row for the one
// being lived, each with the date it reached and the record marked. A table
// from 640px up, compact cards on phones (css/styles.css).

import { memo, useState } from "react"
import { getBestOfLife, getLifePeakCoins, getTaskById } from "../game/engine.ts"
import { Job, Skill } from "../game/classes.ts"
import { gameData } from "../game/state.ts"
import type { Life, LifeBest } from "../game/state.ts"
import { getWorldDay } from "../game/calendar.ts"
import { endedOn, getRecord, reachedText } from "../game/history.ts"
import { sameData, useGameValue } from "./gameStore.ts"
import { classNames } from "./classNames.ts"
import { FormattedCoins } from "./CoinParts.tsx"
import { formatCoins } from "./format.ts"
import type { CoinPart } from "./format.ts"

// Past lives shown before "Show all"
const RECENT_LIVES = 10

// "Footman 31"; a task the game no longer has is "Unknown 31"
function bestText(best: LifeBest): string {
    return (getTaskById(best.id)?.name ?? "Unknown") + " " + best.level
}

function endedText(life: Life): string {
    return (life.end == "evil" ? "Embraced evil at " : "Touched the eye at ") + life.age
}

interface Row {
    key: string
    life: number
    reached: string // the date it ended, or today
    furthest: boolean
    job: string
    skill: string
    peak: CoinPart[]
    ended: string
    endedTitle?: string // the evil an evil life gained
    living: boolean
}

// A row for each life shown, the one being lived last; none before the first rebirth
function getRows(showAll: boolean): Row[] {
    if (gameData.lives.length == 0) return []
    const record = getRecord()
    const shown = showAll ? gameData.lives : gameData.lives.slice(-RECENT_LIVES)
    const rows: Row[] = shown.map(life => ({
        key: "past-" + life.life,
        life: life.life,
        reached: reachedText(endedOn(life)),
        furthest: record.life == life.life,
        job: bestText(life.job),
        skill: bestText(life.skill),
        peak: formatCoins(life.peakCoins),
        ended: endedText(life),
        endedTitle: life.end == "evil" ? "+" + life.evil.toFixed(1) + " evil" : undefined,
        living: false,
    }))
    const living = gameData.rebirthOneCount + gameData.rebirthTwoCount + 1
    rows.push({
        key: "living",
        life: living,
        reached: reachedText(getWorldDay()),
        furthest: record.life == living,
        job: bestText(getBestOfLife(Job)),
        skill: bestText(getBestOfLife(Skill)),
        peak: formatCoins(getLifePeakCoins()),
        ended: "Living",
        living: true,
    })
    return rows
}

export const PastLives = memo(function PastLives() {
    const [showAll, setShowAll] = useState(false)
    const rows = useGameValue(() => getRows(showAll), sameData)
    const lives = useGameValue(() => gameData.lives.length)
    if (rows.length == 0) return null

    return (
        <section id="pastLives" className="past-lives" aria-labelledby="pastLivesLabel">
            <h2 id="pastLivesLabel" className="card-label">Past lives</h2>
            <div role="table" aria-labelledby="pastLivesLabel" className="past-table">
                <div role="row" className="past-row past-head">
                    <span role="columnheader">Life</span>
                    <span role="columnheader">Reached</span>
                    <span role="columnheader">Best job</span>
                    <span role="columnheader">Best skill</span>
                    <span role="columnheader">Peak purse</span>
                    <span role="columnheader">Ended</span>
                </div>
                {rows.map(row => (
                    <div role="row" key={row.key} className={classNames("past-row", row.living && "past-living")}>
                        <strong role="cell" className="past-life">{row.life}</strong>
                        <span role="cell" className="past-reached">
                            {row.reached}
                            {row.furthest && <>{" "}<span className="past-furthest">Furthest</span></>}
                        </span>
                        <span className="past-detail">
                            <span role="cell" className="past-job">{row.job}</span>
                            <span role="cell" className="past-skill">{row.skill}</span>
                            <span role="cell" className="past-peak"><FormattedCoins parts={row.peak} /></span>
                        </span>
                        <span role="cell" className="past-ended" title={row.endedTitle}>{row.ended}</span>
                    </div>
                ))}
            </div>
            <p className="card-note past-note">
                Reached is the date a life ended. Every life wakes at 14 in Summer 1200, so a longer life sees further.
                The Chronicle in Settings draws the same lives as bars.
            </p>
            {lives > RECENT_LIVES && (
                <button type="button" className="quiet-button past-more" aria-expanded={showAll}
                    onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Show recent lives" : "Show all " + lives + " lives"}
                </button>
            )}
        </section>
    )
})
