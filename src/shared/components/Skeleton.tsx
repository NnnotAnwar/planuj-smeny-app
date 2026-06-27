/**
 * --- SKELETON ---
 * A single shimmering placeholder block. Compose several to mimic the shape of
 * content while it loads — calmer than a spinner and avoids layout jump.
 */
export function Skeleton({ className = '' }: { className?: string }) {
    return <span className={`block animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-700/50 ${className}`} />;
}
