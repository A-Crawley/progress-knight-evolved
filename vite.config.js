import { execSync } from "node:child_process"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// Record mode (`npm run dev:record`) records your playthroughs; see the
// README. Every other mode, the build included, leaves the recorder out.
export const RECORD_MODE = "record"
// Recordings live in IndexedDB, which belongs to one address, so record
// mode always uses this port
export const RECORD_PORT = 5180

const BUILD_INFO = "virtual:record-build-info"

function git(command) {
    try {
        return execSync("git " + command, {encoding: "utf8", stdio: ["ignore", "pipe", "ignore"]}).trim()
    } catch {
        return ""
    }
}

// Tells the recorder which commit it's recording and whether there were
// uncommitted changes. It's worked out again after any file changes, so
// reloading the page after an edit records the edit.
function recordBuildInfo() {
    const resolved = "\0" + BUILD_INFO
    return {
        name: "record-build-info",
        resolveId: id => id == BUILD_INFO ? resolved : undefined,
        load(id) {
            if (id != resolved) return undefined
            const info = {commit: git("rev-parse HEAD") || "unknown", dirty: git("status --porcelain") != ""}
            return "export default " + JSON.stringify(info)
        },
        configureServer(server) {
            server.watcher.on("all", () => {
                const module = server.moduleGraph.getModuleById(resolved)
                if (module) server.moduleGraph.invalidateModule(module)
            })
        },
    }
}

export default defineConfig(({mode}) => {
    const recording = mode == RECORD_MODE
    return {
        // The game is published at https://a-crawley.github.io/progress-knight-evolved/
        base: "/progress-knight-evolved/",
        plugins: recording ? [react(), recordBuildInfo()] : [react()],
        // A hot reload would restart the game under the recorder
        server: recording ? {port: RECORD_PORT, strictPort: true, hmr: false} : undefined,
    }
})
