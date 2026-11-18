// Plays the bot (strategy.ts) from a new game, life after life, and reports
// how far each life got: lifespan, the year it reached, and the real time it
// would take a player, with and without time warping.
//
//   npm run bot -- [--lives 40] [--minutes 10] [--evil 500] [--out lives.jsonl]
//
// Stops at whichever limit comes first. It imports the game's TypeScript
// directly, so it needs Node 23.6 or later.

import fs from "node:fs"
import { parseArgs } from "node:util"
import { initGameData } from "../../src/game/engine.ts"
import { gameData } from "../../src/game/state.ts"
import { playLife } from "./strategy.ts"

const {values} = parseArgs({options: {
    lives: {type: "string", default: "40"},
    minutes: {type: "string", default: "10"},
    evil: {type: "string", default: "Infinity"},
    out: {type: "string"},
}})
const maxLives = Number(values.lives)
const maxMs = Number(values.minutes) * 60_000
const maxEvil = Number(values.evil)
const out = values.out ? fs.createWriteStream(values.out) : null

function hours(seconds) {
    return (seconds / 3600).toFixed(2) + "h"
}

function row(report) {
    return [
        String(report.life).padStart(4),
        report.ended.padEnd(7),
        ("evil " + report.evil.toFixed(1)).padEnd(14),
        ("lifespan " + report.lifespan.toFixed(1)).padEnd(15),
        ("reached " + report.year).padEnd(12),
        hours(report.seconds).padStart(7) + " (" + hours(report.secondsWithoutWarping) + " unwarped)",
        report.job,
    ].join("  ")
}

initGameData()
const started = Date.now()
for (let i = 0; i < maxLives && Date.now() - started < maxMs && gameData.evil < maxEvil; i++) {
    const report = playLife()
    console.log(row(report))
    out?.write(JSON.stringify(report) + "\n")
}
out?.end()
