// The playthrough recorder (src/dev/) runs only under `npm run dev:record`.
// The built site must not contain any of it. The same build in record mode
// shows the markers below really are the recorder's.

import { test } from "vitest"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { build } from "vite"

const ROOT = path.join(import.meta.dirname, "..")
// Strings only the recorder has: its database and storage key, the badge's
// class and the note dialog's label
const MARKERS = ["pk-recorder", "rec-badge", "Add a note to the recording", "startRecording"]

async function buildText(mode) {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "pk-build-"))
    try {
        await build({root: ROOT, configFile: path.join(ROOT, "vite.config.js"), mode, logLevel: "silent", build: {outDir, emptyOutDir: true}})
        const files = fs.readdirSync(outDir, {recursive: true}).map(String).filter(file => /\.(js|css|html)$/.test(file))
        return files.map(file => file + "\n" + fs.readFileSync(path.join(outDir, file), "utf8")).join("\n")
    } finally {
        fs.rmSync(outDir, {recursive: true, force: true})
    }
}

test("the built site contains no recorder code", async () => {
    const text = await buildText("production")
    for (const marker of MARKERS) assert.ok(!text.includes(marker), "found " + marker)
})

test("a record-mode build does contain the recorder, so the markers are real", async () => {
    const text = await buildText("record")
    for (const marker of MARKERS) assert.ok(text.includes(marker), "missing " + marker)
})
