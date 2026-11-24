// Record mode's indicator, always on top of the game: a magenta frame around
// the page, a "DEV · ● REC" badge and a [REC] prefix on the tab's title. All
// three turn grey while the recording is paused. The badge opens a menu to
// pause, add a note, export or delete the recordings, and asks for an export
// after 3 hours. M adds a note from anywhere but a text field.
//
// It renders in a React root of its own, so the game's components don't know
// it's there.

import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import { createRoot } from "react-dom/client"
import { NOTE_TAGS } from "./recording-types.ts"
import type { NoteTag } from "./recording-types.ts"
import type { Recorder } from "./recorder.ts"
import "./recorder.css"

function formatElapsed(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60
    return (h > 0 ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0")
}

function download(text: string): void {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")
    const url = URL.createObjectURL(new Blob([text], {type: "application/x-ndjson"}))
    const link = document.createElement("a")
    link.href = url
    link.download = "pk-recording-" + stamp + ".jsonl"
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isTyping(target: EventTarget | null): boolean {
    return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
}

// Shows the recorder's status again whenever it changes, and once a second
// for the clock
function useRecorderStatus(recorder: Recorder) {
    const [, setTick] = useState(0)
    useEffect(() => {
        const bump = () => setTick(tick => tick + 1)
        const stop = recorder.subscribe(bump)
        const timer = setInterval(bump, 1000)
        return () => {
            stop()
            clearInterval(timer)
        }
    }, [recorder])
    return recorder.status()
}

function NoteDialog({onSave, onClose}: {onSave: (tag: NoteTag | null, text: string) => void, onClose: () => void}) {
    const [tag, setTag] = useState<NoteTag | null>(null)
    const [text, setText] = useState("")
    const input = useRef<HTMLInputElement>(null)
    useEffect(() => input.current?.focus(), [])
    const save = () => {
        if (tag || text.trim()) onSave(tag, text)
        onClose()
    }
    const onKeyDown = (event: ReactKeyboardEvent) => {
        // Keys typed here are the note's, not the game's
        event.stopPropagation()
        if (event.key == "Escape") onClose()
        if (event.key == "Enter") save()
    }
    return (
        <div className="rec-note" role="dialog" aria-label="Add a note to the recording" onKeyDown={onKeyDown}>
            <div className="rec-note-tags" role="group" aria-label="How it feels">
                {NOTE_TAGS.map(option => (
                    <button key={option} type="button" className="rec-chip" aria-pressed={tag == option}
                        onClick={() => setTag(tag == option ? null : option)}>{option}</button>
                ))}
            </div>
            <input ref={input} className="rec-note-text" type="text" placeholder="Note (optional)" value={text}
                onChange={event => setText(event.target.value)} />
            <div className="rec-row">
                <button type="button" className="rec-button rec-primary" onClick={save}>Save note</button>
                <button type="button" className="rec-button" onClick={onClose}>Cancel</button>
            </div>
        </div>
    )
}

export function RecorderOverlay({recorder, build}: {recorder: Recorder, build: {commit: string, dirty: boolean}}) {
    const status = useRecorderStatus(recorder)
    const [menuOpen, setMenuOpen] = useState(false)
    const [noting, setNoting] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [message, setMessage] = useState("")
    const baseTitle = useRef(document.title.replace(/^\[REC[^\]]*\] /, ""))

    useEffect(() => {
        document.title = (status.recording ? "[REC] " : "[REC ⏸] ") + baseTitle.current
    }, [status.recording])

    // M adds a note; Escape or a press outside the badge closes the menu
    const dock = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key == "Escape") setMenuOpen(false)
            if (event.key.toLowerCase() != "m" || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
            event.preventDefault()
            setMenuOpen(false)
            setNoting(true)
        }
        const onPointerDown = (event: PointerEvent) => {
            if (!dock.current?.contains(event.target as Node)) setMenuOpen(false)
        }
        window.addEventListener("keydown", onKeyDown)
        document.addEventListener("pointerdown", onPointerDown, true)
        return () => {
            window.removeEventListener("keydown", onKeyDown)
            document.removeEventListener("pointerdown", onPointerDown, true)
        }
    }, [])

    const exportRecordings = async () => {
        download(await recorder.exportJsonl())
        setMessage("Exported")
    }
    const deleteRecordings = async () => {
        await recorder.clearRecordings()
        setConfirmingDelete(false)
        setMessage("Deleted")
    }

    const state = status.recording ? "rec-on" : "rec-paused"
    return (
        <>
            <div className={"rec-frame " + state} aria-hidden="true" />
            <div ref={dock} className={"rec-dock " + state}>
                {menuOpen && (
                    <div className="rec-menu" role="menu" aria-label="Recording">
                        <div className="rec-meta">
                            {status.events} {status.events == 1 ? "event" : "events"} · {build.commit.slice(0, 7)}{build.dirty ? " (uncommitted changes)" : ""}
                        </div>
                        {status.exportDue && <div className="rec-reminder">It&apos;s been 3 hours: export the recording.</div>}
                        <div className="rec-row">
                            <button type="button" className="rec-button" role="menuitem" onClick={() => recorder.setRecording(!status.recording)}>
                                {status.recording ? "Pause recording" : "Resume recording"}
                            </button>
                            <button type="button" className="rec-button" role="menuitem" onClick={() => {setMenuOpen(false); setNoting(true)}}>Note (M)</button>
                        </div>
                        <div className="rec-row">
                            <button type="button" className="rec-button rec-primary" role="menuitem" onClick={exportRecordings}>Export JSONL</button>
                            {confirmingDelete ? <>
                                <button type="button" className="rec-button rec-danger" role="menuitem" onClick={deleteRecordings}>Yes, delete all</button>
                                <button type="button" className="rec-button" role="menuitem" onClick={() => setConfirmingDelete(false)}>Keep</button>
                            </> : (
                                <button type="button" className="rec-button" role="menuitem" onClick={() => setConfirmingDelete(true)}>Delete…</button>
                            )}
                        </div>
                        {message && <div className="rec-meta" role="status">{message}</div>}
                    </div>
                )}
                {noting && <NoteDialog onSave={(tag, text) => {recorder.note(tag, text); setMessage("Note saved")}} onClose={() => setNoting(false)} />}
                <button type="button" className={"rec-badge" + (status.exportDue ? " rec-due" : "")} aria-expanded={menuOpen}
                    onClick={() => {setMenuOpen(!menuOpen); setMessage("")}}>
                    <span className="rec-dev">DEV</span>
                    <span aria-hidden="true">·</span>
                    <span className="rec-dot" aria-hidden="true">{status.recording ? "●" : "❚❚"}</span>
                    <span>{status.recording ? "REC" : "PAUSED"}</span>
                    <span className="rec-time">{formatElapsed(status.elapsedMs)}</span>
                    {status.exportDue && <span className="rec-due-text">Export</span>}
                </button>
            </div>
        </>
    )
}

export function showRecorderOverlay(recorder: Recorder, build: {commit: string, dirty: boolean}): void {
    const host = document.createElement("div")
    host.id = "recorder-overlay"
    document.body.appendChild(host)
    createRoot(host).render(<RecorderOverlay recorder={recorder} build={build} />)
}
