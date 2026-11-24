// The Shop: properties and misc items, each with whether it's in use, its
// effect and its daily upkeep, and what the next one needs.

import { Fragment, memo } from "react"
import type { CSSProperties } from "react"
import { headerRowColors, itemCategories, tooltips } from "../game/data.ts"
import { selectProperty, toggleMisc } from "./actions.ts"
import { gameData } from "../game/state.ts"
import { sameData, shallowEqual, useGameValue } from "./gameStore.ts"
import { FormattedCoins } from "./CoinParts.tsx"
import { RequiredRow, isCategoryHidden, isCategoryUnseen } from "./RequiredRow.tsx"
import { classNames, removeSpaces } from "./classNames.ts"
import { formatCoins, splitEffect } from "./format.ts"
import { useLongPressTooltip } from "./useLongPressTooltip.ts"
import { getEraRow } from "../game/eras.ts"
import type { EraRow } from "../game/eras.ts"
import { getCategoryEraHint } from "./eraText.ts"
import { ClosedBar, OpensBar } from "./TaskTable.tsx"

const categoryHints: Record<string, string> = {
    "Properties": "one at a time",
    "Misc": "any number",
}

export function ShopTable() {
    // Every item shares the same expense multipliers (Bargaining, Intimidation)
    const discount = useGameValue(() => Number(gameData.itemData["Tent"].expenseMultipliers.reduce((product, multiplier) => product * multiplier(), 1).toFixed(2)))
    // Shown and hidden as the categories are revealed
    const unseen = useGameValue(() => Object.keys(itemCategories).map(isCategoryUnseen), shallowEqual)
    const locked = useGameValue(() => Object.keys(itemCategories).map(isCategoryHidden), shallowEqual)
    const eraHints = useGameValue(() => Object.values(itemCategories).map(names => getCategoryEraHint(names, gameData.itemData)), shallowEqual)
    return (
        <>
            <div className="table-scroll">
                <table id="itemTable" className="w3-table w3-bordered task-table shop-table">
                    <tbody>
                        {Object.entries(itemCategories).map(([categoryName, names], index) => (
                            <Fragment key={categoryName}>
                                <tr className={classNames(removeSpaces(categoryName), "headerRow", locked[index] && "locked-header", unseen[index] && "hidden")}
                                    style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
                                    <th className="category">
                                        {categoryName}
                                        <span className="category-hint">{categoryHints[categoryName]}</span>
                                        {eraHints[index] && <span className="category-hint era-hint">{eraHints[index]}</span>}
                                    </th>
                                    <th className="col-active">In use</th>
                                    <th className="col-effect">Effect</th>
                                    <th className="col-upkeep">Upkeep / day</th>
                                </tr>
                                {names.map(name => <ItemRow key={name} name={name} isProperty={categoryName == "Properties"} categoryName={categoryName} />)}
                                <RequiredRow categoryName={categoryName} category={names} items={true} />
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
            <p className="shop-note">
                Upkeep includes your Bargaining discount{discount != 1 && " (×" + discount + ")"}. Running out of coins makes you homeless and sells every item.
            </p>
        </>
    )
}

// Labelled where it stands alone; the phone tick sits in a button whose
// aria-pressed already says it
function CheckIcon({className, label}: {className: string, label?: string}) {
    return (
        <svg className={className} {...(label ? {role: "img", "aria-label": label} : {"aria-hidden": true})} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    )
}

// Everything a row shows for an item
function getRow(name: string, categoryName: string) {
    const item = gameData.itemData[name]
    const expense = item.getExpense()
    // "x2.0 Happiness" -> "×2" and "happiness"
    const effect = splitEffect(item.getEffectDescription())
    const unlocked = gameData.requirements[name].completed
    const era: EraRow = getEraRow(item.baseData, unlocked)
    return {
        era,
        // A row opening in a later era shows locked once any life has reached
        // it; a closed one shows if this life unlocked it
        hidden: isCategoryUnseen(categoryName) || era.kind == "unseen" || (era.kind == "open" && !unlocked),
        active: gameData.currentMisc.includes(item) || item == gameData.currentProperty,
        affordable: gameData.coins >= expense,
        multiplier: effect.multiplier.replace(/\.0$/, ""),
        what: effect.what,
        expense: expense == 0 ? null : formatCoins(expense),
    }
}

const ItemRow = memo(function ItemRow({name, isProperty, categoryName}: {name: string, isProperty: boolean, categoryName: string}) {
    const {era, hidden, active: isActive, affordable, multiplier, what, expense} = useGameValue(() => getRow(name, categoryName), sameData)
    const tooltipId = "tip-" + removeSpaces(name)
    const longPress = useLongPressTooltip()
    return (
        <tr id={"row " + name} className={classNames(hidden && "hidden")}
            style={{"--cat": headerRowColors[categoryName as keyof typeof headerRowColors]} as CSSProperties}>
            <td>
                {era.kind == "closed" && <ClosedBar name={name} era={era} />}
                {era.kind == "opens" && <OpensBar name={name} year={era.year} />}
                {era.kind == "open" &&
                <button type="button" className={classNames("item-button tooltip", longPress.shown && "tooltip-open")} disabled={!affordable} aria-pressed={isActive} aria-describedby={tooltipId} {...longPress.handlers}
                    onClick={() => isProperty ? selectProperty(name) : toggleMisc(name)}>
                    <span className="name">{name}</span>
                    {/* Phones show the tick inside the button (hidden from 640px) */}
                    {era.kind == "open" && era.closesIn !== null && <span className="closes-hint">{"Closes in " + era.closesIn}</span>}
                    {isActive && <CheckIcon className="item-tick" />}
                    <span className="tooltipText" id={tooltipId} aria-hidden="true">{tooltips[name]}</span>
                </button>}
            </td>
            <td className="in-use">
                {isActive
                    ? <CheckIcon className="active" label="In use" />
                    : <span className="not-in-use" role="img" aria-label="Not in use">—</span>}
            </td>
            <td className={classNames("effect", era.kind != "open" && "era-muted")}><strong>{multiplier}</strong> <span>{what}</span></td>
            <td className={classNames("expense", !expense && "free")}>{era.kind != "open" ? "—" : expense ? <FormattedCoins parts={expense} /> : "Free"}</td>
        </tr>
    )
})
