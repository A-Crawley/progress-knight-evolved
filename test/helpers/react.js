// Renders a React component of the page with a fresh game, for component
// tests (which run with // @vitest-environment jsdom).
//
// Each call gets new copies of the game's modules (vi.resetModules), so no
// state is shared between tests. React itself is shared.

import path from "node:path"
import { afterEach, vi } from "vitest"
import { act, cleanup, render } from "@testing-library/react"
import { createElement } from "react"
import { useGameData } from "./gameData.js"

const ROOT = path.join(import.meta.dirname, "..", "..")

afterEach(() => {
    cleanup()
    localStorage.clear()
    vi.unstubAllGlobals()
})

// file: the component's file in src/ui (e.g. "App.tsx"); component: its
// export (e.g. "App"). With options.data, the game plays on changed game
// data (see useGameData in gameData.js); options.before(engine, gameData)
// runs after the new game is built, before the first render.
async function renderComponent(file, component, props = {}, options = {}) {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    vi.resetModules()
    useGameData(options.data)
    const engine = await import(path.join(ROOT, "src/game/engine.ts"))
    const { gameData } = await import(path.join(ROOT, "src/game/state.ts"))
    const store = await import(path.join(ROOT, "src/ui/gameStore.ts"))
    const bars = await import(path.join(ROOT, "src/ui/fillBar.ts"))
    const module = await import(path.join(ROOT, "src/ui", file))

    // A new game, as the page starts one
    engine.initGameData()
    engine.update()
    if (options.before) options.before(engine, gameData)

    const view = render(createElement(module[component], props))
    // A render, with the progress bars put straight at their shares (the page
    // slides them there over the next frames)
    const show = () => act(() => {
        store.requestRender()
        bars.paintBarsNow()
    })
    return {
        ...view,
        engine,
        gameData,
        task: name => gameData.taskData[name],
        // The transform a progress bar's fill has at a share (0 to 1)
        fillTransform: bars.fillTransform,
        // Shows the current game state, as the render timer would
        rerender: show,
        // Game steps, then a render
        ticks(count) {
            for (let i = 0; i < count; i++) engine.update()
            show()
        },
    }
}

export { renderComponent }
