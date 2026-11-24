// Record mode's entry point: main.tsx loads it only when Vite runs in record
// mode (`npm run dev:record`), so the built site never contains it. It
// starts the recorder, watches the page for what the recorder can't see in
// the game (attention, tabs, tooltips) and shows the recording indicator.

import buildInfo from "virtual:record-build-info"
import { startRecorder, localMeta } from "./recorder.ts"
import type { Recorder } from "./recorder.ts"
import { indexedDbStore } from "./storage.ts"
import { showRecorderOverlay } from "./RecorderOverlay.tsx"

// No input for this long counts as idle
export const IDLE_AFTER_MS = 60 * 1000
// A tooltip shown for less than this was only passed over
export const TOOLTIP_MIN_MS = 500

declare global {
    interface Window {
        // Set once the recorder is running, so a second load does nothing
        pkRecorder?: Recorder
    }
}

function watchAttention(recorder: Recorder): void {
    document.addEventListener("visibilitychange", () => recorder.attention(document.hidden ? "hidden" : "visible"))
    window.addEventListener("focus", () => recorder.attention("focus"))
    window.addEventListener("blur", () => recorder.attention("blur"))

    let idle = false
    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const onInput = () => {
        if (idle) {
            idle = false
            recorder.attention("active")
        }
        clearTimeout(idleTimer)
        idleTimer = setTimeout(() => {
            idle = true
            recorder.attention("idle")
        }, IDLE_AFTER_MS)
    }
    for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
        window.addEventListener(type, onInput, {capture: true, passive: true})
    }
    onInput()
}

// Tabs and tooltips are watched from the document, so the game's components
// don't need to know about the recorder
function watchInteractions(recorder: Recorder): void {
    document.addEventListener("click", event => {
        const tab = (event.target as Element).closest?.("[data-tab]")
        if (tab) recorder.ui({what: "tab", tab: tab.getAttribute("data-tab") ?? ""})
    }, true)

    // The element with a tooltip under the pointer, and since when
    let shown: {element: Element, since: number} | null = null
    const close = () => {
        if (!shown) return
        const ms = Math.round(performance.now() - shown.since)
        const target = shown.element.querySelector(".name")?.textContent ?? shown.element.textContent?.trim().slice(0, 40) ?? ""
        if (ms >= TOOLTIP_MIN_MS) recorder.ui({what: "tooltip", target, ms})
        shown = null
    }
    document.addEventListener("pointerover", event => {
        const element = (event.target as Element).closest?.(".tooltip") ?? null
        if (element == shown?.element) return
        close()
        if (element) shown = {element, since: performance.now()}
    }, true)
    document.addEventListener("pointerleave", close)
    window.addEventListener("blur", close)
}

export function startRecording(): Recorder {
    if (window.pkRecorder) return window.pkRecorder
    const recorder = startRecorder({store: indexedDbStore(), meta: localMeta(), build: buildInfo})
    window.pkRecorder = recorder
    watchAttention(recorder)
    watchInteractions(recorder)
    showRecorderOverlay(recorder, buildInfo)
    return recorder
}

startRecording()
