// @vitest-environment jsdom

// The playthrough recorder (src/dev/recorder.ts), which runs only under
// `npm run dev:record`. It plays the real game here, with its events kept in
// memory instead of IndexedDB.

import { test, beforeEach, afterEach, vi } from "vitest"
import assert from "node:assert/strict"
import { advanceGameTime, initGameData, setSkillWithLowestMaxXp, update } from "../src/game/engine.ts"
import { getLifespan } from "../src/game/rules.ts"
import { gameData } from "../src/game/state.ts"
import { importSave, exportSave, loadGameData } from "../src/game/save.ts"
import { selectTask, setAutoLearn, setAutoPromote, togglePause, rebirthOne } from "../src/ui/actions.ts"
import { Recorder, startRecorder, memoryMeta, HEARTBEAT_MS, HIDDEN_HEARTBEAT_MS, EXPORT_REMINDER_MS } from "../src/dev/recorder.ts"
import { memoryStore } from "../src/dev/storage.ts"

const build = {commit: "abc123", dirty: true}
initGameData()
update()
const freshSave = exportSave()

// Runs this many game steps through the game loop, as the page does
function steps(count) {
    advanceGameTime(count * 50)
}

let recorder
let store
let meta

function record(options = {}) {
    store = memoryStore()
    meta = options.meta ?? memoryMeta()
    recorder = new Recorder({store, meta, build, ...options})
    recorder.start()
    return recorder
}

function eventsOf(kind) {
    return store.events.filter(event => event.kind == kind)
}

beforeEach(() => {
    // Each test starts a new game
    assert.equal(importSave(freshSave), undefined)
    initGameData()
    loadGameData()
    update()
})

afterEach(() => {
    recorder?.stop()
    vi.useRealTimers()
})

test("a session starts with the commit, and every event carries both clocks", () => {
    record()
    const [session] = store.events
    assert.equal(session.kind, "session")
    assert.equal(session.commit, "abc123")
    assert.equal(session.dirty, true)
    steps(3)
    recorder.note("fun", "  nice  ")
    const note = eventsOf("note")[0]
    assert.equal(note.text, "nice")
    assert.equal(note.steps, 3)
    assert.equal(note.days, gameData.days)
    assert.equal(typeof note.t, "number")
    assert.deepEqual(store.events.map(event => event.seq), store.events.map((_, i) => i))
})

test("starting the recorder twice is safe", () => {
    record()
    recorder.start()
    assert.equal(eventsOf("session").length, 1)
    selectTask("Farmer")
    steps(1)
    assert.equal(eventsOf("action").length, 1, "each action is recorded once")
    assert.equal(recorder.activeSteps, 1, "each step is counted once")
})

test("the page keeps its first recorder", () => {
    store = memoryStore()
    recorder = startRecorder({store, meta: memoryMeta(), build})
    assert.equal(startRecorder({store: memoryStore(), meta: memoryMeta(), build}), recorder)
    assert.equal(eventsOf("session").length, 1)
})

test("a player's change is an action, with the save from before it", () => {
    record()
    const before = exportSave()
    selectTask("Farmer")
    const [action] = eventsOf("action")
    assert.deepEqual(action.action, {type: "selectTask", name: "Farmer"})
    assert.equal(action.saveBefore, before)
    assert.deepEqual(action.changes, [{field: "job", from: "Beggar", to: "Farmer"}])
    steps(5)
    assert.equal(eventsOf("auto").length, 0, "the step after it doesn't count it again")
})

test("auto-learn following the skill timer is automation, not the player", () => {
    record()
    selectTask("Productivity")
    setAutoLearn(true)
    // The timer picks the skill; auto-learn takes it up on the next step
    setSkillWithLowestMaxXp()
    assert.equal(gameData.currentSkill.name, "Productivity")
    steps(1)
    assert.equal(gameData.currentSkill.name, "Concentration")
    const auto = eventsOf("auto")
    assert.deepEqual(auto.map(event => [event.cause, event.change]),
        [["autoLearn", {field: "skill", from: "Productivity", to: "Concentration"}]])
    assert.deepEqual(eventsOf("action").map(event => event.action.type), ["selectTask", "setAutoLearn"])
})

test("auto-promote is automation, with its cause", () => {
    record()
    setAutoPromote(true)
    gameData.taskData["Beggar"].level = 10
    steps(2)
    const [promotion] = eventsOf("auto")
    assert.equal(promotion.cause, "autoPromote")
    assert.deepEqual(promotion.change, {field: "job", from: "Beggar", to: "Farmer"})
})

test("unlocks are logged once, and a rebirth's starting unlocks aren't new ones", () => {
    record()
    gameData.taskData["Beggar"].level = 10
    steps(1)
    const first = eventsOf("unlock").find(event => event.name == "Farmer")
    assert.ok(first, "Farmer unlocks")
    assert.equal(first.firstEver, true)
    steps(5)
    assert.equal(eventsOf("unlock").filter(event => event.name == "Farmer").length, 1)

    const before = eventsOf("unlock").length
    rebirthOne()
    steps(5)
    assert.equal(eventsOf("unlock").length, before, "nothing unlocks just by starting a new life")

    gameData.taskData["Beggar"].level = 10
    steps(1)
    const again = eventsOf("unlock").slice(before)
    assert.deepEqual(again.map(event => [event.name, event.firstEver]), [["Farmer", false]])
})

test("active steps count only while the game moves: not while paused or dead", () => {
    record()
    steps(10)
    assert.equal(recorder.activeSteps, 10)
    togglePause()
    steps(10)
    assert.equal(recorder.activeSteps, 10, "paused")
    togglePause()
    steps(1)
    assert.equal(recorder.activeSteps, 11)

    gameData.days = getLifespan() - 0.01
    steps(10)
    assert.equal(eventsOf("lifeOver").length, 1)
    assert.ok(recorder.activeSteps <= 12, "at most the step that ended the life counts")
    const dead = recorder.activeSteps
    steps(10)
    assert.equal(recorder.activeSteps, dead, "dead")
})

test("the clocks carry on from the last session", () => {
    const shared = memoryMeta()
    record({meta: shared})
    steps(4)
    recorder.stop()
    record({meta: shared})
    steps(2)
    assert.equal(recorder.activeSteps, 6)
})

test("pausing the recording logs nothing but the pause and resume", () => {
    record()
    recorder.setRecording(false)
    assert.equal(recorder.status().recording, false)
    recorder.note("bored", "")
    selectTask("Farmer")
    steps(5)
    recorder.setRecording(true)
    assert.deepEqual(store.events.map(event => event.kind), ["session", "recording", "recording"])
    assert.deepEqual(eventsOf("recording").map(event => event.what), ["paused", "resumed"])
    assert.equal(recorder.activeSteps, 5, "the clocks kept counting")
    steps(1)
    assert.equal(eventsOf("auto").length, 0, "what changed while paused isn't put down to automation")
})

test("heartbeats come every 30 s, and every 5 min while the page is hidden", () => {
    vi.useFakeTimers()
    record({now: () => Date.now()})
    vi.advanceTimersByTime(HEARTBEAT_MS)
    assert.equal(eventsOf("heartbeat").length, 1)
    const [beat] = eventsOf("heartbeat")
    assert.equal(beat.snapshot.job, "Beggar")
    assert.equal(typeof beat.save, "string")
    recorder.attention("hidden")
    vi.advanceTimersByTime(HIDDEN_HEARTBEAT_MS - HEARTBEAT_MS)
    assert.equal(eventsOf("heartbeat").length, 1)
    vi.advanceTimersByTime(HEARTBEAT_MS)
    assert.equal(eventsOf("heartbeat").length, 2)
    recorder.attention("visible")
    vi.advanceTimersByTime(HEARTBEAT_MS)
    assert.equal(eventsOf("heartbeat").length, 3)
})

test("notes, interactions and attention are logged as they come", () => {
    record()
    recorder.note("stuck", "what next?")
    recorder.note(null, "just text")
    recorder.ui({what: "tab", tab: "shop"})
    recorder.ui({what: "tooltip", target: "Farmer", ms: 900})
    recorder.attention("idle")
    const kinds = store.events.slice(1).map(event => [event.kind, "tag" in event ? event.tag : event.what])
    assert.deepEqual(kinds, [["note", "stuck"], ["note", null], ["ui", "tab"], ["ui", "tooltip"], ["attention", "idle"]])
})

test("export gives valid JSONL and resets the 3-hour reminder", async () => {
    let now = 1000
    record({now: () => now})
    selectTask("Farmer")
    now += EXPORT_REMINDER_MS
    assert.equal(recorder.status().exportDue, true)
    const text = await recorder.exportJsonl()
    const lines = text.trimEnd().split("\n").map(line => JSON.parse(line))
    assert.deepEqual(lines.map(event => event.kind), ["session", "action"])
    assert.equal(recorder.status().exportDue, false)
    await recorder.clearRecordings()
    assert.equal(store.events.length, 0)
})
