// @vitest-environment jsdom

// Eras on the page, played on the test-only Test age (1230) from
// test/fixtures/era-data.js.

import { test } from "vitest"
import assert from "node:assert/strict"
import { renderComponent } from "../helpers/react.js"
import { withTestEra } from "../fixtures/era-data.js"

const row = name => document.getElementById("row " + name)

test("a component can be rendered on test-only game data", async () => {
    await renderComponent("TaskTable.tsx", "TaskTable", { kind: "jobs" }, { data: withTestEra })
    assert.ok(row("Test trader"))
})

test("the next render is the real game again", async () => {
    await renderComponent("TaskTable.tsx", "TaskTable", { kind: "jobs" })
    assert.equal(row("Test trader"), null)
})
