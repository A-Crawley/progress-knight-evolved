// The compact header on phones: title, pause button, coins, net per day,
// age and the world's date, a life bar and a row for each event running. Header.tsx holds the same numbers behind ids (tests
// and wider screens use those), so this uses classes only.

import { useRef } from "react"
import { daysToYears, getLifespan } from "../game/rules.ts"
import { getExpense, getIncome, getNet, isLifeOver } from "../game/engine.ts"
import { togglePause } from "./actions.ts"
import { daysLeftInSeason, formatDate, getWorldDay, toDate } from "../game/calendar.ts"
import { getActiveEvents } from "../game/events.ts"
import { effectColor, effectText } from "./eventText.ts"
import type { SeasonId } from "../game/data.ts"
import { gameData } from "../game/state.ts"
import { sameData, useGameValue } from "./gameStore.ts"
import { FormattedCoins } from "./CoinParts.tsx"
import { formatCoins } from "./format.ts"
import { getLifeShare } from "./life.ts"
import { useFillBar } from "./fillBar.ts"
import { SeasonIcon } from "./SeasonIcon.tsx"

const signColors: Record<string, string> = {"+": "var(--pk-gain)", "-": "var(--pk-loss)", "": "var(--pk-text-muted)"}

// Everything the phone header shows, so it renders only when some of it changes
function getView() {
    const income = getIncome()
    const expense = getExpense()
    const date = toDate(getWorldDay())
    const left = daysLeftInSeason(getWorldDay())
    return {
        paused: gameData.paused,
        coins: formatCoins(gameData.coins),
        net: formatCoins(getNet()),
        sign: income > expense ? "+" : expense > income ? "-" : "",
        age: daysToYears(gameData.days),
        lifespan: daysToYears(getLifespan()),
        season: date.season.id as SeasonId,
        date: formatDate(date),
        events: getActiveEvents().map(running => ({
            name: running.event.name,
            effects: running.event.effects.map(effect => ({label: effect.label, text: effectText(effect), color: effectColor(effect, true)})),
        })),
        left: left + (left == 1 ? " day" : " days"),
        lifeOver: isLifeOver(),
    }
}

// How far through its life the character is, for the life bar
function getLifeBarShare(): number {
    return getLifeShare(gameData.days)
}

export function PhoneHeader() {
    const {paused, coins, net, sign, age, lifespan, season, date, events, left, lifeOver} = useGameValue(getView, sameData)
    const lifeFill = useRef<HTMLDivElement>(null)
    useFillBar(lifeFill, getLifeBarShare)
    return (
        <header className="phone-header">
            <div className="phone-header-row">
                <span className="phone-header-title">Progress Knight</span>
                <button type="button" className="phone-header-pause" aria-label={paused ? "Play" : "Pause"} onClick={togglePause}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {paused ? <path d="M7 5l12 7-12 7z" /> : <path d="M8 5v14M16 5v14" />}
                    </svg>
                </button>
            </div>
            <div className="phone-header-row">
                <span className="phone-header-coins"><FormattedCoins parts={coins} /></span>
                <span className="phone-header-net">
                    <span style={{color: signColors[sign]}}>{sign}</span><FormattedCoins parts={net} />/ day
                </span>
            </div>
            <div className="phone-header-row phone-header-muted">
                <span>Age <b>{age}</b> · <span className="life-date"><SeasonIcon season={season} size={14} /><b className="phone-header-date">{date}</b></span></span>
                <span>Lifespan {lifespan}</span>
            </div>
            <div className="life-bar" role="img" aria-label={"Age " + age + " of " + lifespan}>
                <div className="life-bar-fill" ref={lifeFill}></div>
            </div>
            {events.map(event => (
                <div key={event.name} className="phone-header-event">
                    <strong>{event.name}</strong>
                    {event.effects.map(effect => (
                        <span key={effect.label}>{" "}<span className="phone-header-effect" style={{color: effect.color}}>{effect.text}</span></span>
                    ))}
                    {" "}
                    <span className="phone-header-event-left">{left}</span>
                </div>
            ))}
            {lifeOver && <div className="phone-header-death">Age has caught up to you</div>}
        </header>
    )
}
