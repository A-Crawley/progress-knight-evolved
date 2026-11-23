import { createRoot } from "react-dom/client"
import "./fonts.css"
import { advanceGameTime, initGameData, setSkillWithLowestMaxXp, update } from "./game/engine.ts"
import { loadGameData, saveGameData } from "./game/save.ts"
import { updateSpeed } from "./game/rules.ts"
import { App } from "./ui/App.tsx"
import { onGameSteps } from "./ui/gameStore.ts"
import { paintBars } from "./ui/fillBar.ts"
import { setBackgroundInterval } from "./backgroundTimer.ts"
import { applyPreferences } from "./ui/preferences.ts"

initGameData()
loadGameData()
update()

// The saved theme goes on before React renders, so it doesn't flash
applyPreferences()

// The one element outside React: where it renders the page
createRoot(document.getElementById("root") as HTMLElement).render(<App />)

// Runs the game steps for the real time that has passed since the last call,
// and returns how many it ran. Timers can fire late or be throttled, so the
// time is measured.
let lastLoopTime = performance.now()

function gameLoop(now: number): number {
    if (now <= lastLoopTime) return 0
    const steps = advanceGameTime(now - lastLoopTime)
    lastLoopTime = now
    return steps
}

// While the page is shown, the game runs on animation frames, so its steps,
// the renders after them and the progress bars all keep to the same clock
// and the bars move at an even speed (see fillBar.ts). Animation frames stop in a
// background tab, so then a timer that keeps running there (see
// backgroundTimer.ts) runs the game instead, without rendering.
const stepInterval = 1000 / updateSpeed
let lastFrameTime = -Infinity

function onFrame(now: number) {
    lastFrameTime = now
    const steps = gameLoop(now)
    onGameSteps(steps)
    paintBars(now, steps)
    requestAnimationFrame(onFrame)
}
requestAnimationFrame(onFrame)

setBackgroundInterval(() => {
    const now = performance.now()
    if (now - lastFrameTime > 5 * stepInterval) gameLoop(now)
}, stepInterval)

setBackgroundInterval(saveGameData, 3000)
setBackgroundInterval(setSkillWithLowestMaxXp, 1000)
