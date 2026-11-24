// The era banner: a card at the top of the Jobs tab when a life first
// enters a later era, saying what it closed and what took its place. One
// click on Onward dismisses it for the rest of the life. Its entrance and
// the pennant's wave are fx-anim, so reduced motion and the Amulet effects
// setting turn them off.

import { jobs, items } from "../game/data.ts"
import { getInheritedXpMultiplier } from "../game/engine.ts"
import { dismissEraBanner } from "./actions.ts"
import { eraStartDay, getEraBanner } from "../game/eras.ts"
import { formatDate, toDate } from "../game/calendar.ts"
import { Job } from "../game/classes.ts"
import { gameData } from "../game/state.ts"
import type { JobDefinition, ItemDefinition } from "../game/types.ts"
import { sameData, useGameValue } from "./gameStore.ts"
import { EraIcon } from "./EraIcon.tsx"

// What the era closed that this life had: jobs it unlocked and items it
// could buy, each with what took its place and, for a job, the bonus its
// successor inherits
function getHandoffs(year: number) {
    const closing = (definitions: readonly (JobDefinition | ItemDefinition)[]) => definitions.filter(definition =>
        definition.closesIn == year && definition.successor !== undefined && gameData.requirements[definition.name].completed)
    const handoffs: {from: string, to: string, bonus: string | null}[] = []
    for (const definition of [...closing(jobs), ...closing(items)]) {
        const successor = [...jobs, ...items].find(other => other.id == definition.successor) as JobDefinition | ItemDefinition
        const task = gameData.taskData[successor.name]
        const multiplier = task instanceof Job ? getInheritedXpMultiplier(task) : 1
        handoffs.push({from: definition.name, to: successor.name, bonus: multiplier > 1 ? "×" + Number(multiplier.toFixed(2)) + " XP" : null})
    }
    return handoffs
}

function getView() {
    const era = getEraBanner()
    if (!era) return null
    return {
        id: era.id,
        title: "The " + era.name,
        began: formatDate(toDate(eraStartDay(era))),
        description: era.description,
        handoffs: getHandoffs(era.startYear),
    }
}

export function EraBanner() {
    const view = useGameValue(getView, sameData)
    return (
        // Announced politely when it appears; focus stays where it was
        <div aria-live="polite" className="era-banner-slot">
            {view && (
                <section key={view.id} className="era-banner fx-anim" aria-labelledby="eraBannerTitle">
                    <span className="era-banner-crest" aria-hidden="true"><EraIcon size={26} className="era-icon era-banner-pennant fx-anim" /></span>
                    <div className="era-banner-body">
                        <span className="era-banner-kicker">{"A new era · " + view.began}</span>
                        {" "}
                        <h2 id="eraBannerTitle" className="era-banner-title">{view.title}</h2>
                        {" "}
                        <p className="era-banner-text">{view.description}</p>
                        {view.handoffs.length > 0 && <>
                            {" "}
                            <p className="era-banner-text">Some work and goods have closed for the rest of this life and passed to a successor, which learns faster for every level you reached in the old one.</p>
                            {" "}
                            <ul className="era-handoffs">
                                {view.handoffs.map(handoff => (
                                    <li key={handoff.from} className="era-handoff">
                                        <span className="era-handoff-from">{handoff.from}</span>
                                        {" "}
                                        <svg role="img" aria-label="became" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                        {" "}
                                        <strong>{handoff.to}</strong>
                                        {handoff.bonus && <>{" "}<span className="era-handoff-bonus">{handoff.bonus}</span></>}
                                    </li>
                                ))}
                            </ul>
                        </>}
                    </div>
                    {" "}
                    <button type="button" className="era-banner-button" onClick={() => dismissEraBanner(view.id)}>Onward</button>
                </section>
            )}
        </div>
    )
}
