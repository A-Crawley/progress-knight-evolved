// The whole page: the header, the sidebar, the tab bar and the selected tab.

import { memo, useEffect, useState } from "react"
import { flushSync } from "react-dom"
import type { ReactNode } from "react"
import { isUnlocked } from "../game/engine.ts"
import { gameData } from "../game/state.ts"
import { useGameValue } from "./gameStore.ts"
import { Sidebar } from "./Sidebar.tsx"
import { Header } from "./Header.tsx"
import { PhoneHeader } from "./PhoneHeader.tsx"
import { TaskTable } from "./TaskTable.tsx"
import { ShopTable } from "./ShopTable.tsx"
import { AmuletTab } from "./AmuletTab.tsx"
import { SettingsTab } from "./SettingsTab.tsx"
import { classNames } from "./classNames.ts"
import { getPreferences } from "./preferences.ts"

export type TabName = "jobs" | "skills" | "shop" | "rebirth" | "settings"

const tabs: {name: TabName, label: string, id?: string, unlock?: string, end?: boolean}[] = [
    {name: "jobs", label: "Jobs", id: "jobTabButton"},
    {name: "skills", label: "Skills"},
    {name: "shop", label: "Shop", id: "shopTabButton", unlock: "shop"},
    {name: "rebirth", label: "Amulet", id: "rebirthTabButton", unlock: "rebirth_tab"},
    {name: "settings", label: "Settings", end: true},
]

const phoneQuery = "(max-width: 639px)"

// The sidebar is open at tablet width and up (the summary is hidden there)
// and starts closed on phones. Without matchMedia (tests) it stays open.
function useSidebarOpen() {
    const hasMatchMedia = typeof matchMedia == "function"
    const [open, setOpen] = useState(() => !hasMatchMedia || !matchMedia(phoneQuery).matches)
    useEffect(() => {
        if (!hasMatchMedia) return
        const query = matchMedia(phoneQuery)
        const onChange = () => setOpen(!query.matches)
        query.addEventListener("change", onChange)
        return () => query.removeEventListener("change", onChange)
    }, [hasMatchMedia])
    return [open, setOpen] as const
}

// The height of the headers that stay on screen as the page scrolls (the
// compact header on phones), so whatever is scrolled to isn't hidden under them
function getStickyHeight(): number {
    let height = 0
    for (const header of document.querySelectorAll<HTMLElement>(".site-header, .phone-header")) {
        const position = getComputedStyle(header).position
        if ((position == "sticky" || position == "fixed") && header.offsetParent !== null) height += header.offsetHeight
    }
    return height
}

// The tabs unlocked so far, as their names: "jobs skills shop"
function getUnlockedTabs(): string {
    return tabs.filter(tab => !tab.unlock || isUnlocked(tab.unlock)).map(tab => tab.name).join(" ")
}

// The page renders only when a tab is picked, a tab unlocks or a life ends;
// everything in it picks out what it shows itself
export function App() {
    const [selectedTab, setSelectedTab] = useState<TabName>("jobs")
    const [sidebarOpen, setSidebarOpen] = useSidebarOpen()

    // The Almanac's link: the Settings tab, scrolled to the Chronicle, whose
    // heading takes the focus. The tab is shown first, so it can scroll.
    const openChronicle = () => {
        flushSync(() => setSelectedTab("settings"))
        const heading = document.getElementById("chronicleLabel")
        if (!heading) return
        scrollTo({top: heading.getBoundingClientRect().top + scrollY - getStickyHeight() - 16,
            behavior: getPreferences().reducedMotion ? "auto" : "smooth"})
        heading.focus({preventScroll: true})
    }

    // After a rebirth the page goes back to the Jobs tab
    const rebirths = useGameValue(() => gameData.rebirthOneCount + gameData.rebirthTwoCount)
    const unlockedTabs = useGameValue(getUnlockedTabs).split(" ")
    const [shownRebirths, setShownRebirths] = useState(rebirths)
    if (rebirths != shownRebirths) {
        setShownRebirths(rebirths)
        setSelectedTab("jobs")
    }

    return (
        <>
            <Header />
            <PhoneHeader />
            <div className="page">
                {" "}
                <div className="layout">
                    {" "}
                    <details className="sidebar-details" open={sidebarOpen} onToggle={event => setSidebarOpen(event.currentTarget.open)}>
                        <summary>Details</summary>
                        <Sidebar onOpenChronicle={openChronicle} />
                    </details>
                    {" "}
                    <div className="main">
                        <nav aria-label="Sections" className="panel tab-bar" style={{"--tab-count": unlockedTabs.length} as React.CSSProperties}>
                            {" "}
                            {tabs.map(tab => (
                                <TabButton key={tab.name} tab={tab} unlocked={unlockedTabs.includes(tab.name)} selected={tab.name == selectedTab} onSelect={setSelectedTab} />
                            ))}
                        </nav>
                        {" "}
                        <div className="panel tab-panel">
                            {" "}
                            <Tab name="jobs" selected={selectedTab}><TaskTable kind="jobs" /></Tab>
                            {" "}
                            <Tab name="skills" selected={selectedTab}><TaskTable kind="skills" /></Tab>
                            {" "}
                            <Tab name="shop" selected={selectedTab}><ShopTable /></Tab>
                            {" "}
                            <Tab name="rebirth" selected={selectedTab}><AmuletTab /></Tab>
                            {" "}
                            <Tab name="settings" selected={selectedTab}><SettingsTab /></Tab>
                            {" "}
                        </div>
                    </div>
                    {" "}
                </div>
                {" "}
            </div>
        </>
    )
}

// onSelect: picks a tab by name; it stays the same function between renders
const TabButton = memo(function TabButton({tab, unlocked, selected, onSelect}: {tab: typeof tabs[number], unlocked: boolean, selected: boolean, onSelect: (name: TabName) => void}) {
    return (
        <>
            <button type="button" id={tab.id} data-tab={tab.name} onClick={() => onSelect(tab.name)} aria-current={selected ? "page" : undefined}
                className={classNames("w3-button w3-bar-item tabButton", tab.end && "tab-end", !unlocked && "hidden", selected && "w3-blue-gray")}>
                {tab.label}
            </button>
            {" "}
        </>
    )
})

function Tab({name, selected, children}: {name: TabName, selected: TabName, children: ReactNode}) {
    return (
        <div className="tab" id={name} style={{display: name == selected ? "block" : "none"}}>
            {" "}
            {children}
            {" "}
        </div>
    )
}
