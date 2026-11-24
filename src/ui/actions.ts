// Everything the player can do that changes the game: each action calls the
// engine and then shows the result. Components call these instead of the
// engine, so every player action goes through one place.
//
// observeActions lets dev tools (the playthrough recorder, src/dev/) see each
// action as it happens. Nothing observes them in the game itself.

import { dismissEraBanner as dismissBanner, rebirthOne as engineRebirthOne, rebirthTwo as engineRebirthTwo,
    setAutoLearn as engineSetAutoLearn, setAutoPromote as engineSetAutoPromote, setMisc, setPause, setProperty,
    setSkillSkipped as engineSetSkillSkipped, setTask, setTimeWarping } from "../game/engine.ts"
import { clearSave, importSave as engineImportSave } from "../game/save.ts"
import { requestRender } from "./gameStore.ts"

// One player action and what it acted on
export type PlayerAction =
    | {type: "selectTask", name: string}
    | {type: "selectProperty", name: string}
    | {type: "toggleMisc", name: string}
    | {type: "togglePause"}
    | {type: "toggleTimeWarp"}
    | {type: "setAutoPromote", enabled: boolean}
    | {type: "setAutoLearn", enabled: boolean}
    | {type: "setSkillSkipped", name: string, skipped: boolean}
    | {type: "dismissEraBanner", eraId: string}
    | {type: "rebirthOne"}
    | {type: "rebirthTwo"}
    | {type: "importSave"}
    | {type: "hardReset"}

// Sees an action before it runs and runs it with run(), exactly once
export type ActionObserver = (action: PlayerAction, run: () => void) => void

const runAction: ActionObserver = (_action, run) => run()
let observer: ActionObserver = runAction

// Replaces the observer; returns a function that puts the plain one back
export function observeActions(next: ActionObserver): () => void {
    observer = next
    return () => {
        if (observer == next) observer = runAction
    }
}

function act(action: PlayerAction, run: () => void): void {
    observer(action, run)
    requestRender()
}

export function selectTask(name: string): void {
    act({type: "selectTask", name}, () => setTask(name))
}

export function selectProperty(name: string): void {
    act({type: "selectProperty", name}, () => setProperty(name))
}

export function toggleMisc(name: string): void {
    act({type: "toggleMisc", name}, () => setMisc(name))
}

export function togglePause(): void {
    act({type: "togglePause"}, setPause)
}

export function toggleTimeWarp(): void {
    act({type: "toggleTimeWarp"}, setTimeWarping)
}

export function setAutoPromote(enabled: boolean): void {
    act({type: "setAutoPromote", enabled}, () => engineSetAutoPromote(enabled))
}

export function setAutoLearn(enabled: boolean): void {
    act({type: "setAutoLearn", enabled}, () => engineSetAutoLearn(enabled))
}

export function setSkillSkipped(name: string, skipped: boolean): void {
    act({type: "setSkillSkipped", name, skipped}, () => engineSetSkillSkipped(name, skipped))
}

export function dismissEraBanner(eraId: string): void {
    act({type: "dismissEraBanner", eraId}, () => dismissBanner(eraId))
}

export function rebirthOne(): void {
    act({type: "rebirthOne"}, engineRebirthOne)
}

export function rebirthTwo(): void {
    act({type: "rebirthTwo"}, engineRebirthTwo)
}

// Imports a save and reloads the page; returns why not if it can't
export function importSave(text: string): string | undefined {
    let error: string | undefined
    act({type: "importSave"}, () => {error = engineImportSave(text)})
    if (!error) location.reload()
    return error
}

// Deletes the save and starts again from nothing
export function hardReset(): void {
    act({type: "hardReset"}, clearSave)
    location.reload()
}
