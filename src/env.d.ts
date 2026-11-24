// What Vite tells the page about how it was started (the project doesn't
// load vite/client's types)
interface ImportMetaEnv {
    // "development" for npm run dev, "production" for the build, "record" for
    // npm run dev:record
    readonly MODE: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

// Record mode's commit and working-tree state (see vite.config.js)
declare module "virtual:record-build-info" {
    const info: {commit: string, dirty: boolean}
    export default info
}
