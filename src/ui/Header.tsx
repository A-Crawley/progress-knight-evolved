// The header from tablet width up: the title, how far through its life the
// character is and the world's date with any events running, the game speed
// and the pause button. Phones have
// PhoneHeader instead (this one is hidden under 640px).

import { daysToYears, getGameSpeed, getLifespan } from "../game/rules.ts"
import { isLifeOver, setPause } from "../game/engine.ts"
import { formatDate, getWorldDay, toDate } from "../game/calendar.ts"
import { getActiveEvents } from "../game/events.ts"
import type { SeasonId } from "../game/data.ts"
import { gameData } from "../game/state.ts"
import { requestRender, sameData, useGameValue } from "./gameStore.ts"
import { classNames } from "./classNames.ts"
import { getLifeShare } from "./life.ts"
import { fillStyle } from "./fill.ts"
import { SeasonIcon } from "./SeasonIcon.tsx"

// Everything the header shows, so it renders only when some of it changes
function getView() {
    const date = toDate(getWorldDay())
    const lifeOver = isLifeOver()
    // getGameSpeed() would also clamp the age to the lifespan, and picking
    // values out never changes the game state
    const speed = lifeOver ? 0 : getGameSpeed()
    return {
        age: daysToYears(gameData.days),
        lifespan: daysToYears(getLifespan()),
        season: date.season.id as SeasonId,
        date: formatDate(date),
        events: getActiveEvents().map(running => running.event.name),
        lifeShare: getLifeShare(gameData.days),
        speed: gameData.paused ? "Paused" : speed > 0 ? Number(speed.toFixed(2)) + " days / sec" : "",
        paused: gameData.paused,
        lifeOver,
    }
}

export function Header() {
    const {age, lifespan, season, date, events, lifeShare, speed, paused, lifeOver} = useGameValue(getView, sameData)
    return (
        <header className="site-header">
            <div className="site-header-inner">
                <div className="wordmark-block">
                    <h1 className="wordmark">Progress Knight</h1>
                    <span className="wordmark-tag">Evolved</span>
                </div>
                <div className="life-block">
                    <div className="life-block-row">
                        <span className="life-age">Age <b id="ageDisplay">{age}</b> · <span className="life-date"><SeasonIcon season={season} /><span id="dateDisplay">{date}</span></span>{events.map(name => <span key={name}>{" "}<span className="event-chip">{name}</span></span>)}</span>
                        <span className="life-left"><b>{Math.max(0, lifespan - age)} years</b> left of <span id="lifespanDisplay">{lifespan}</span></span>
                    </div>
                    <div className="life-bar" role="img" aria-label={"Life progress: age " + age + " of " + lifespan}>
                        <div className="life-bar-fill" style={fillStyle(lifeShare)}></div>
                    </div>
                </div>
                <div className="speed-block">
                    <span className="speed-text">{speed}</span>
                    <button type="button" id="pauseButton" className="w3-button button header-pause" onClick={() => {setPause(); requestRender()}}>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            {paused ? <path d="M7 5l12 7-12 7z" /> : <path d="M9 5v14M15 5v14" />}
                        </svg>
                        {paused ? "Play" : "Pause"}
                    </button>
                </div>
                <div id="deathText" className={classNames("header-death", !lifeOver && "hidden")}>
                    <div className="header-death-title">Age has caught up to you</div>
                    <div>Your age has met your lifespan, use the amulet to rebirth before you pass away</div>
                </div>
            </div>
        </header>
    )
}
