// The bot (tools/bot/strategy.ts) plays from a new game the way a good
// player would. This checks that the game can still be played past its
// first walls: Immortality, which needs Apprentice mage 10, and age 200,
// which opens Embrace evil. A balance change that walls a good player off
// before them fails here.

import { test } from "vitest"
import assert from "node:assert/strict"
import { loadEngine } from "./helpers/engine.js"

test("a good player reaches Immortality, then 200 and evil, within eight lives", { timeout: 120_000 }, async () => {
    const game = await loadEngine()
    // Loaded after the engine, so the bot plays the same game
    const bot = await import("../tools/bot/strategy.ts")
    const lives = []
    while (lives.length < 8 && game.gameData.rebirthTwoCount == 0) lives.push(bot.playLife())

    const first = lives.find(life => life.lifespan > 70)
    assert.ok(first, "some life outlives 70: " + lives.map(life => life.lifespan.toFixed(1)).join(", "))
    assert.ok(first.immortality > 0)
    const evil = lives.at(-1)
    assert.equal(evil.ended, "evil", "a life reaches 200 and embraces evil")
    assert.ok(evil.age >= 200)
    assert.equal(game.gameData.evil > 0, true)
    assert.ok(lives.slice(0, -1).every(life => life.ended == "rebirth"))
})
