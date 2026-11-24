// The Almanac, a small sidebar card: today's date, the days to the next
// season, the era (and the next one, once glimpsed), how far through this
// season the world is, the furthest date any
// life has reached (or "New furthest" once this life passes it), the events
// running or
// the next one, and a way to the Chronicle in Settings. "Coming up" opens a
// list of the next few events. It appears with the Amulet tab, and stays
// once a life has been lived.

import { useRef, useState } from "react"
import { calendar, eras } from "../game/data.ts"
import { eraStartDay, getEra, getGlimpsedEra, isEraNew } from "../game/eras.ts"
import { EraIcon } from "./EraIcon.tsx"
import type { SeasonId } from "../game/data.ts"
import { daysLeftInSeason, formatDate, getWorldDay, toDate } from "../game/calendar.ts"
import { isUnlocked } from "../game/engine.ts"
import { gameData } from "../game/state.ts"
import { getActiveEvents, getUpcomingEvents, isNew } from "../game/events.ts"
import { getRecord, reachedText, toRoman } from "../game/history.ts"
import { effectColor, effectText, seasonYearText, untilText } from "./eventText.ts"
import { sameData, useGameValue } from "./gameStore.ts"
import { classNames } from "./classNames.ts"
import { useFillBar } from "./fillBar.ts"
import { SeasonIcon } from "./SeasonIcon.tsx"

// Whether the calendar's history is shown yet: the Almanac, and the
// Chronicle in Settings. The Amulet tab hides again at each rebirth, so a
// life already lived keeps them in sight.
export function isHistoryShown(): boolean {
    return isUnlocked("rebirth_tab") || gameData.lives.length > 0
}

// Events listed under "Coming up"
const UPCOMING_EVENTS = 3

// Everything the Almanac shows, so it renders only when some of it changes
function getView(expanded: boolean) {
    const today = getWorldDay()
    const date = toDate(today)
    const season = date.season
    const next = calendar.seasons[(date.seasonIndex + 1) % calendar.seasons.length]
    const left = daysLeftInSeason(today)
    const upcoming = getUpcomingEvents(today, UPCOMING_EVENTS)
    const showList = expanded && upcoming.length > 0
    return {
        shown: isHistoryShown(),
        hasUpcoming: upcoming.length > 0,
        showList,
        season: season.id as SeasonId,
        date: formatDate(date),
        toNext: left + (left == 1 ? " day" : " days") + " to " + next.name,
        barLabel: season.name + ", day " + date.dayOfSeason + " of " + season.days,
        record: getRecordLine(),
        running: getActiveEvents().map(occurrence => ({
            id: occurrence.event.id,
            name: occurrence.event.name,
            began: isNew(occurrence, today),
            left: left + (left == 1 ? " day left" : " days left"),
            effects: occurrence.event.effects.map(effect => ({label: effect.label, text: effectText(effect), color: effectColor(effect, true)})),
            description: occurrence.event.description,
        })),
        upcoming: (showList ? upcoming : []).map(occurrence => ({
            key: occurrence.event.id + " " + occurrence.year,
            season: occurrence.event.season as SeasonId,
            name: occurrence.event.name,
            until: untilText(occurrence.start - today),
            when: seasonYearText(occurrence) + " · " + occurrence.event.effects.map(effectText).join(", "),
        })),
        nextEvent: upcoming.length > 0 ? {name: upcoming[0].event.name, until: untilText(upcoming[0].start - today)} : null,
        era: getEraLine(today),
    }
}

// The era today is in, and the next one once it's glimpsed: "Age of Guilds
// in 23 years". A later era than the first is shown in the era colour, with
// "Began" for its first days.
function getEraLine(today: number) {
    const era = getEra(toDate(today).year)
    const glimpsed = getGlimpsedEra()
    return {
        name: era?.name ?? null,
        later: era !== undefined && era != eras[0],
        began: isEraNew(today),
        glimpsed: glimpsed ? {name: glimpsed.name, until: untilText(eraStartDay(glimpsed) - today), when: reachedText(eraStartDay(glimpsed))} : null,
    }
}

// How far through this season the world is, for the season bar
function getSeasonShare(): number {
    const date = toDate(getWorldDay())
    return (date.dayOfSeason - 1) / date.season.days
}

type RunningEvent = ReturnType<typeof getView>["running"][number]

export function Almanac({onOpenChronicle}: {onOpenChronicle: () => void}) {
    const [expanded, setExpanded] = useState(false)
    const view = useGameValue(() => getView(expanded), sameData)
    const {showList, running, upcoming} = view
    const seasonFill = useRef<HTMLDivElement>(null)
    useFillBar(seasonFill, getSeasonShare)
    return (
        <section id="almanac" aria-labelledby="almanacLabel" className={classNames("card almanac", !view.shown && "hidden")}>
            <div className="almanac-head">
                <h2 id="almanacLabel" className="card-label">Almanac</h2>
                {view.hasUpcoming && (
                    <button type="button" className="almanac-toggle" aria-expanded={showList} aria-controls="almanacUpcoming" onClick={() => setExpanded(!expanded)}>
                        {showList ? "Hide" : "Coming up"}
                        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={classNames("almanac-chevron", showList && "almanac-chevron-open")}><path d="m6 9 6 6 6-6"></path></svg>
                    </button>
                )}
            </div>
            <div className="almanac-now">
                <div className="almanac-line">
                    <span className="almanac-date"><SeasonIcon season={view.season} /><span id="almanacDate">{view.date}</span></span>
                    <span className="card-note almanac-next">{view.toNext}</span>
                </div>
                {view.era.name && (
                    <span className={classNames("almanac-era", view.era.later && "almanac-era-later")}>
                        <EraIcon />{view.era.name}
                        {view.era.began && <>{" "}<span className="almanac-began almanac-era-began">Began</span></>}
                    </span>
                )}
                {view.era.glimpsed && (
                    <span className="card-note almanac-line almanac-glimpse">
                        <span><strong>{view.era.glimpsed.name}</strong>{" " + view.era.glimpsed.until}</span>
                        {" "}
                        <span>{view.era.glimpsed.when}</span>
                    </span>
                )}
                <div className="life-bar almanac-bar" role="img" aria-label={view.barLabel}>
                    <div ref={seasonFill} className="life-bar-fill" style={{backgroundColor: "var(--pk-season-" + view.season + ")"}}></div>
                </div>
            </div>
            <RecordLine record={view.record} />
            {running.map(event => <EventBox key={event.id} event={event} />)}
            {showList && (
                <div id="almanacUpcoming" className="almanac-upcoming">
                    <h3 className="card-label">Coming up</h3>
                    {upcoming.map(occurrence => (
                        <div key={occurrence.key} className="almanac-coming">
                            <span className="almanac-line">
                                <span className="almanac-coming-name"><SeasonIcon season={occurrence.season} size={14} />{occurrence.name}</span>
                                {" "}
                                <span className="card-note">{occurrence.until}</span>
                            </span>
                            {" "}
                            <span className="card-note">{occurrence.when}</span>
                        </div>
                    ))}
                </div>
            )}
            {running.length == 0 && !showList && view.nextEvent && (
                <span className="card-note almanac-line almanac-next-event">
                    <span>Next: <strong>{view.nextEvent.name}</strong></span>
                    {" "}
                    <span>{view.nextEvent.until}</span>
                </span>
            )}
            <button type="button" className="almanac-link" onClick={onOpenChronicle}>
                Chronicle in Settings
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>
            </button>
        </section>
    )
}

// "Furthest: Winter 1296 · life III, age 110", or "New furthest · past
// Winter 1296" while this life is beyond every life before it. A first life
// has nothing to beat, so no line.
type RecordView = {isNew: true, past: string} | {isNew: false, reached: string, who: string} | null

function getRecordLine(): RecordView {
    const record = getRecord()
    if (record.living && record.previous === null) return null
    if (record.living) return {isNew: true, past: "past " + reachedText(record.previous ?? record.day)}
    return {isNew: false, reached: reachedText(record.day), who: (record.life === null ? "" : "life " + toRoman(record.life) + ", ") + "age " + record.age}
}

function RecordLine({record}: {record: RecordView}) {
    if (!record) return null
    if (record.isNew) {
        return (
            <span className="card-note almanac-line almanac-record almanac-record-new">
                <strong>New furthest</strong>
                {" "}
                <span>{record.past}</span>
            </span>
        )
    }
    return (
        <span className="card-note almanac-line almanac-record">
            <span>Furthest: <strong>{record.reached}</strong></span>
            {" "}
            <span>{record.who}</span>
        </span>
    )
}

// An event running now: its name, "Began" for its first days, the days left,
// its effects and what it is
function EventBox({event}: {event: RunningEvent}) {
    return (
        <div className="almanac-event">
            <div className="almanac-event-head">
                <strong>{event.name}</strong>
                {event.began && <>{" "}<span className="almanac-began">Began</span></>}
                {" "}
                <span className="card-note almanac-event-left">{event.left}</span>
            </div>
            {" "}
            <span className="almanac-effects">
                {event.effects.map((effect, index) => (
                    <span key={effect.label} style={{color: effect.color}}>{(index > 0 ? " " : "") + effect.text}</span>
                ))}
            </span>
            {" "}
            <span className="card-note">{event.description}</span>
        </div>
    )
}
