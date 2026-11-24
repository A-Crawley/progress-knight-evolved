// An era's pennant. It is decoration: the era's name is always written next
// to it, and it takes the colour of the text around it.

export function EraIcon({size = 14, className = "era-icon"}: {size?: number, className?: string}) {
    return (
        <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 21V4h11l-2 4 2 4H5" />
        </svg>
    )
}
