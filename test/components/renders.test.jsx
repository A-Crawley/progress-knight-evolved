// @vitest-environment jsdom

// While the game runs, only the components whose shown values changed
// render again. React tells a DevTools hook about every commit; a stand-in
// hook here lists the components that ran their render in it.

import { test, beforeAll, afterEach } from "vitest"
import assert from "node:assert/strict"

// React looks for the hook when it loads, so everything React is imported
// below, after it's installed
const commits = []
globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberRoot(id, root) { commits.push(renderedIn(root.current)) },
    onPostCommitFiberRoot() {},
    onCommitFiberUnmount() {},
    setStrictMode() {},
}

// React marks a fiber whose render ran with this flag (PerformedWork)
const PERFORMED_WORK = 1

function componentName(fiber) {
    const type = fiber.type
    if (typeof type == "function") return type.displayName || type.name
    // memo(Component)
    if (type && typeof type == "object" && typeof type.type == "function") return type.type.displayName || type.type.name
    return null
}

// The components that rendered in the commit of this tree, as "Name" or
// "Name:key" (rows are keyed by task or item name). A subtree React skipped
// keeps the fibers from before, so it isn't looked into.
function renderedIn(root) {
    const rendered = []
    const visit = fiber => {
        const name = componentName(fiber)
        if (name && (fiber.alternate === null || (fiber.flags & PERFORMED_WORK))) {
            rendered.push(fiber.key === null ? name : name + ":" + fiber.key)
        }
        if (fiber.alternate && fiber.child === fiber.alternate.child) return
        for (let child = fiber.child; child; child = child.sibling) visit(child)
    }
    visit(root)
    return rendered
}

let page
beforeAll(async () => {
    const { renderComponent } = await import("../helpers/react.js")
    page = await renderComponent("App.tsx", "App")
})
afterEach(() => { commits.length = 0 })

async function frame() {
    const { act } = await import("@testing-library/react")
    const store = await import("../../src/ui/gameStore.ts")
    act(() => store.requestRender())
}

test("with the game paused, a frame renders nothing", async () => {
    page.engine.setPause()
    await frame()
    commits.length = 0
    await frame()
    await frame()
    assert.deepEqual(commits.flat(), [])
    page.engine.setPause()
})

test("a game step renders only what shows a changed value", async () => {
    page.engine.update()
    await frame()
    const rendered = commits.flat()
    const job = page.gameData.currentJob.name
    const skill = page.gameData.currentSkill.name
    assert.ok(rendered.length > 0, "something shows the step: the coins, at least")
    assert.ok(!rendered.includes("App"), "the page itself doesn't render: " + rendered.join(", "))
    // Of the rows, only the current job's and skill's XP moved
    const rows = rendered.filter(name => name.startsWith("TaskRow:") || name.startsWith("ItemRow:"))
    assert.ok(rows.every(row => row == "TaskRow:" + job || row == "TaskRow:" + skill), "rows: " + rows.join(", "))
    for (const quiet of ["TaskTable", "TaskHeaderRow", "ShopTable", "AmuletTab", "SettingsTab", "Chronicle", "PastLives", "Sidebar"]) {
        assert.ok(!rendered.some(name => name.split(":")[0] == quiet), quiet + " rendered: " + rendered.join(", "))
    }
})

test("the hook sees renders: picking a tab renders the page", async () => {
    const { act, fireEvent } = await import("@testing-library/react")
    act(() => { fireEvent.click(document.querySelector("[data-tab=shop]")) })
    assert.ok(commits.flat().includes("App"))
})
