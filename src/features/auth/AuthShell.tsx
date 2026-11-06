import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SunIcon, MoonIcon } from '@phosphor-icons/react';
import { useTheme } from '@app/providers/ThemeContext';
import { useTranslation } from '@shared/preferences/PreferencesContext';

/**
 * --- AUTH SHELL ---
 * The frame shared by the signed-out pages (sign in, create an organization):
 * ambient glow, theme toggle, the glass card with the brand mark + title, and
 * the footer line. Pages pass their form (and anything under the card).
 */
export function AuthShell({ title, eyebrow, children, below }: { title: string; eyebrow: string; children: ReactNode; below?: ReactNode }) {
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';
    const t = useTranslation();

    return (
        <div className="relative min-h-dvh flex items-center justify-center overflow-hidden px-4 pb-10 pt-[calc(4rem+env(safe-area-inset-top,0px))] sm:py-10">
            {/* Ambient brand glow */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />

            {/* Theme toggle */}
            <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                aria-label={t('common.toggleTheme')}
                className="absolute top-[calc(1rem+env(safe-area-inset-top,0px))] right-[calc(1rem+env(safe-area-inset-right,0px))] z-10 p-2 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-gray-300 backdrop-blur-md hover:bg-white/80 dark:hover:bg-white/10 active:scale-90 transition-all"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={resolvedTheme}
                        initial={{ y: -6, opacity: 0, rotate: -30 }}
                        animate={{ y: 0, opacity: 1, rotate: 0 }}
                        exit={{ y: 6, opacity: 0, rotate: 30 }}
                        transition={{ duration: 0.2 }}
                        className="block"
                    >
                        {isDark ? <SunIcon weight="bold" className="size-4" /> : <MoonIcon weight="bold" className="size-4" />}
                    </motion.span>
                </AnimatePresence>
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className="relative w-full max-w-md"
            >
                <div className="glass rounded-2xl p-6 sm:p-8 [--glass-shadow:var(--shadow-glass-lg)]">
                    {/* Brand */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl bg-emerald-500/40 blur-xl" />
                            <div className="relative size-12 bg-linear-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <span className="font-display text-white font-bold text-lg tracking-wide">PS</span>
                            </div>
                        </div>
                        <h1 className="text-display text-ink dark:text-white mt-4">{title}</h1>
                        <p className="text-eyebrow text-emerald-600 dark:text-emerald-300 mt-2">{eyebrow}</p>
                    </div>
                    {children}
                </div>
                {below}
                <p className="text-center text-micro text-gray-400 mt-5">Planuj Směny · 2026</p>
            </motion.div>
        </div>
    );
}
