// @vitest-environment jsdom

// Record mode's indicator (src/dev/RecorderOverlay.tsx): badge, frame and
// title, the M note hotkey and pausing.

import { test, beforeEach, afterEach } from "vitest"
import assert from "node:assert/strict"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { initGameData, update } from "../../src/game/engine.ts"
import { Recorder, memoryMeta } from "../../src/dev/recorder.ts"
import { memoryStore } from "../../src/dev/storage.ts"
import { RecorderOverlay } from "../../src/dev/RecorderOverlay.tsx"

initGameData()
update()

let recorder
let store

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    document.title = "Progress Knight"
    store = memoryStore()
    recorder = new Recorder({store, meta: memoryMeta(), build: {commit: "0123456789", dirty: false}})
    recorder.start()
    render(<RecorderOverlay recorder={recorder} build={{commit: "0123456789", dirty: false}} />)
})

afterEach(() => {
    cleanup()
    recorder.stop()
})

test("the badge, frame and title say it's recording", () => {
    const badge = screen.getByRole("button", {expanded: false})
    assert.match(badge.textContent, /DEV·●REC/)
    assert.ok(document.querySelector(".rec-frame.rec-on"))
    assert.equal(document.title, "[REC] Progress Knight")
})

test("pausing from the menu turns all three grey", () => {
    fireEvent.click(screen.getByRole("button", {expanded: false}))
    fireEvent.click(screen.getByRole("menuitem", {name: "Pause recording"}))
    assert.ok(document.querySelector(".rec-frame.rec-paused"))
    assert.match(screen.getByRole("button", {expanded: true}).textContent, /PAUSED/)
    assert.equal(document.title, "[REC ⏸] Progress Knight")
    fireEvent.click(screen.getByRole("menuitem", {name: "Resume recording"}))
    assert.equal(document.title, "[REC] Progress Knight")
})

test("M opens a note; a tag and text save it, Escape doesn't", () => {
    act(() => {fireEvent.keyDown(window, {key: "m"})})
    const dialog = screen.getByRole("dialog")
    fireEvent.click(screen.getByRole("button", {name: "confused"}))
    fireEvent.change(dialog.querySelector("input"), {target: {value: "which job now?"}})
    fireEvent.keyDown(dialog.querySelector("input"), {key: "Enter"})
    assert.equal(screen.queryByRole("dialog"), null)
    act(() => {fireEvent.keyDown(window, {key: "M"})})
    fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"})
    const notes = store.events.filter(event => event.kind == "note")
    assert.deepEqual(notes.map(note => [note.tag, note.text]), [["confused", "which job now?"]])
})

test("M while typing in a text field types, rather than opening a note", () => {
    const field = document.createElement("textarea")
    document.body.appendChild(field)
    act(() => {fireEvent.keyDown(field, {key: "m"})})
    assert.equal(screen.queryByRole("dialog"), null)
    field.remove()
})
