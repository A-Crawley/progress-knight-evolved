// The Chronicle, in the Settings tab: how far every life reached. Every life
// wakes at 14 in Summer 1200, so a life is a bar from there to the date it
// reached; the reach chart stacks them, newest first, with the record
// marked. A list below gives each life a strip of its Summers and Winters on
// the same scale, and a lane above the strip marking each event it lived
// through. The life being lived updates live.

import { useState } from "react"
import type { CSSProperties } from "react"
import { DAYS_PER_YEAR, toDate, WAKE_DAY } from "../game/calendar.ts"
import { calendar, events } from "../game/data.ts"
import { getEventsInSpan, isEventUnlocked, isRare } from "../game/events.ts"
import type { EventOccurrence } from "../game/events.ts"
import { getLifeSpans, getRecord, reachedText, toRoman } from "../game/history.ts"
import type { LifeSpan, WorldRecord } from "../game/history.ts"
import { useGame } from "./gameStore.ts"
import { classNames } from "./classNames.ts"
import { isHistoryShown } from "./Almanac.tsx"

// Lives listed before "Show all"
const RECENT_LIVES = 3

// The reach chart's rows shrink as lives are added, to keep it about this
// tall, but no thinner than ROW_MIN; below ROW_LABELS only every fifth life
// keeps its numeral
const CHART_HEIGHT = 240
const ROW_MAX = 16
const ROW_MIN = 6
const ROW_LABELS = 12

// Where the "Furthest" label sits left of the marker rather than right of it (%)
const LABEL_FLIP = 30

function plural(count: number, one: string, many: string): string {
    return count + " " + (count == 1 ? one : many)
}

// The scale every bar and strip is drawn on: from 1200 to a round number of
// years a little past the furthest date, and the step between its labels
const NICE = [1, 2, 2.5, 5]
const STEPS = [1, 2, 5, 10, 25, 50]
const MAX_TICKS = 5

export function getScale(furthest: number): {years: number, step: number} {
    const needed = Math.max(20, (furthest - WAKE_DAY) / DAYS_PER_YEAR + 1)
    let years = 0
    for (let power = 1; years == 0; power *= 10) {
        years = (NICE.map(nice => nice * power).find(nice => nice >= needed) ?? 0)
    }
    let step = 0
    for (let power = 1; step == 0; power *= 100) {
        step = STEPS.map(each => each * power).find(each => years / each <= MAX_TICKS) ?? 0
    }
    return {years, step}
}

// The height of the reach chart's rows, in px, for this many lives
export function getRowHeight(lives: number): number {
    return Math.max(ROW_MIN, Math.min(ROW_MAX, Math.floor(CHART_HEIGHT / lives) - 2))
}

// A strip of Summers and Winters from one world day to another, as one
// repeating gradient: a year's width, Summer then Winter, lined up so the
// strip starts on the right day of the year
export function getStripStyle(from: number, to: number): CSSProperties {
    const span = Math.max(1, to - from)
    const offset = toDate(from).dayOfYear / span * 100
    let position = -offset
    const stops: string[] = []
    for (const season of calendar.seasons) {
        const color = "var(--pk-stripe-" + season.id + ")"
        const end = position + season.days / span * 100
        stops.push(color + " " + position.toFixed(4) + "%", color + " " + end.toFixed(4) + "%")
        position = end
    }
    return {backgroundImage: "repeating-linear-gradient(90deg, " + stops.join(", ") + ")"}
}

// The events a life lived through that the player can see, earliest first.
// The life being lived counts those that have begun.
function getLifeEvents(span: LifeSpan): EventOccurrence[] {
    return getEventsInSpan(span.woke, span.ended).filter(found => isEventUnlocked(found.event))
}

// "Arcane Conjunction 1522, 1529 · 6 Tournament Summers · 4 Hard Winters":
// rare events with their years first, then how many of each other one
export function getEventSummary(found: EventOccurrence[]): string {
    const parts: string[] = []
    for (const rare of [true, false]) {
        for (const event of events) {
            if (isRare(event) != rare) continue
            const years = found.filter(occurrence => occurrence.event == event).map(occurrence => occurrence.year)
            if (years.length == 0) continue
            if (rare) parts.push(event.name + " " + years.join(", "))
            else parts.push(years.length == 1 ? event.name : years.length + " " + event.plural)
        }
    }
    return parts.join(" · ")
}

// "Touched the eye at 41 · furthest", "Living, age 34"
function endText(span: LifeSpan, record: WorldRecord): string {
    const text = span.living ? "Living, age " + span.age
        : (span.end == "evil" ? "Embraced evil at " : "Touched the eye at ") + span.age
    return text + (record.life == span.life ? " · furthest" : "")
}

export function Chronicle() {
    useGame()
    const [showAll, setShowAll] = useState(false)
    if (!isHistoryShown()) return null

    const spans = getLifeSpans()
    const record = getRecord()
    const scale = getScale(record.day)
    const toX = (day: number) => (day - WAKE_DAY) / (scale.years * DAYS_PER_YEAR) * 100
    const ticks = []
    for (let year = 0; year < scale.years; year += scale.step) ticks.push(year)

    const newestFirst = [...spans].reverse()
    const listed = showAll ? newestFirst : newestFirst.slice(0, RECENT_LIVES)
    const rowHeight = getRowHeight(spans.length)
    const furthestX = toX(record.day)
    const holder = spans.find(span => span.life == record.life)
    const lives = plural(spans.length, "life", "lives")

    return (
        <section id="chronicle" className="settings-card settings-wide chronicle" aria-labelledby="chronicleLabel">
            <div className="settings-line">
                <h2 id="chronicleLabel" tabIndex={-1}>Chronicle</h2>
                <span className="settings-note chronicle-summary">
                    {lives + " · furthest " + reachedText(record.day) + " (age " + record.age + ")"}
                </span>
            </div>
            <p className="settings-help">Every life begins in {reachedText(WAKE_DAY)}. Live longer to see more of the world.</p>

            <div className="chronicle-overview">
                <div className={classNames("chronicle-reach", rowHeight < ROW_LABELS && "chronicle-reach-dense")} role="img"
                    aria-label={lives + ", each a bar from " + reachedText(WAKE_DAY) + " to the date it reached. The furthest"
                        + (holder ? ", life " + toRoman(holder.life) + "," : "") + " reached " + reachedText(record.day) + "."}
                    style={{"--row-height": rowHeight + "px"} as CSSProperties}>
                    {newestFirst.map(span => (
                        <div key={span.life} className="chronicle-reach-row"
                            title={"Life " + toRoman(span.life) + ": " + endText(span, record) + ", " + (span.living ? "now in " : "reached ") + reachedText(span.ended)}>
                            <span aria-hidden="true" className={classNames("chronicle-numeral", span.life % 5 == 0 && "chronicle-numeral-fifth")}>{toRoman(span.life)}</span>
                            <span className="chronicle-bar-track">
                                <span className={classNames("chronicle-bar", span.living ? "chronicle-bar-now" : span.end == "evil" && "chronicle-bar-evil")}
                                    style={{width: toX(span.ended) + "%"}}></span>
                            </span>
                        </div>
                    ))}
                    <div aria-hidden="true" className="chronicle-marks">
                        <span className="chronicle-furthest" style={{left: furthestX + "%"}}></span>
                        <span className={classNames("chronicle-furthest-label", furthestX < LABEL_FLIP && "chronicle-furthest-label-right")}
                            style={furthestX < LABEL_FLIP ? {left: furthestX + "%"} : {right: (100 - furthestX) + "%"}}>
                            {"Furthest · " + reachedText(record.day)}
                        </span>
                    </div>
                </div>
                <div aria-hidden="true" className="chronicle-ticks">
                    {ticks.map(year => <span key={year} style={{left: year / scale.years * 100 + "%"}}>{calendar.epochYear + year}</span>)}
                </div>
            </div>

            <div className="chronicle-legend">
                <span><span aria-hidden="true" className="chronicle-swatch chronicle-swatch-bar chronicle-bar"></span>Life</span>
                <span><span aria-hidden="true" className="chronicle-swatch chronicle-swatch-bar chronicle-bar-evil"></span>Ended in evil</span>
                <span><span aria-hidden="true" className="chronicle-swatch chronicle-swatch-bar chronicle-bar-now"></span>This life</span>
                {calendar.seasons.map(season => (
                    <span key={season.id}><span aria-hidden="true" className="chronicle-swatch" style={{backgroundColor: "var(--pk-stripe-" + season.id + ")"}}></span>{season.name}</span>
                ))}
                {events.some(isEventUnlocked) && <>
                    <span><span aria-hidden="true" className="chronicle-swatch chronicle-swatch-event"></span>Event (a season)</span>
                    <span><span aria-hidden="true" className="chronicle-swatch chronicle-swatch-event chronicle-rare"></span>Rare event</span>
                </>}
            </div>

            <ol className="chronicle-list">
                {listed.map(span => (
                    <li key={span.life}>
                        <div className="chronicle-life">
                            <span className="chronicle-title">
                                <strong>{"Life " + span.life + (span.living ? " · now" : "")}</strong>
                                <span className="settings-note">{endText(span, record)}</span>
                            </span>
                            <LifeStrip span={span} width={toX(span.ended)} />
                            <span className={classNames("chronicle-years", span.living && "chronicle-years-now")}>{span.living ? "now" : reachedText(span.ended)}</span>
                        </div>
                    </li>
                ))}
            </ol>
            {newestFirst.length > RECENT_LIVES && (
                <button type="button" className="quiet-button chronicle-more" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
                    {showAll ? "Show recent lives" : "Show all " + newestFirst.length + " lives"}
                </button>
            )}
        </section>
    )
}

// A life's Summers and Winters, a lane above them marking each event it lived
// through (rare ones in gold), and a line naming them
function LifeStrip({span, width}: {span: LifeSpan, width: number}) {
    const found = getLifeEvents(span)
    const length = Math.max(1, span.ended - span.woke)
    const label = plural(Math.floor((span.ended - span.woke) / DAYS_PER_YEAR), "year", "years") + " of Summers and Winters, from "
        + reachedText(span.woke) + " to " + reachedText(span.ended) + (found.length ? ", " + plural(found.length, "event", "events") : "")
    const summary = getEventSummary(found)
    return (
        <span className="chronicle-middle">
            <span className="chronicle-track" role="img" aria-label={label} style={{width: width + "%"}}>
                {found.length > 0 && (
                    <span className="chronicle-lane">
                        {found.map(occurrence => {
                            const start = Math.max(occurrence.start, span.woke)
                            const end = Math.min(occurrence.end, span.ended)
                            return <span key={occurrence.event.id + " " + occurrence.year}
                                className={classNames("chronicle-event", isRare(occurrence.event) && "chronicle-rare")}
                                style={{left: (start - span.woke) / length * 100 + "%", width: (end - start) / length * 100 + "%"}}></span>
                        })}
                    </span>
                )}
                <span className="chronicle-strip" style={getStripStyle(span.woke, span.ended)}></span>
            </span>
            {summary && <span className="chronicle-events">{summary}</span>}
        </span>
    )
}
