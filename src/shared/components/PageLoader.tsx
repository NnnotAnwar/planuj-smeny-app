/**
 * --- PAGE LOADER ---
 * Full-viewport loading state shown while a lazy-loaded route chunk is
 * being fetched. Mirrors the spinner used in AppShell for visual consistency.
 */
export function PageLoader() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-white dark:bg-gray-950 transition-colors duration-500">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-emerald-500/20"></div>
        <p className="text-emerald-600 dark:text-emerald-400 font-bold text-sm animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
