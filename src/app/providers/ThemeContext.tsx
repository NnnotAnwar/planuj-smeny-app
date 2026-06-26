/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

/**
 * --- THEME CONTEXT ---
 * Two independent axes:
 *   1. `theme`     — light / dark / system (toggles the `.dark` class).
 *   2. `comboKey`  — the colour scheme: an accent palette + background gradient.
 *
 * The accent works by overriding Tailwind v4's `--color-emerald-*` variables at
 * runtime, so every `emerald-*` utility across the app re-tints to the chosen
 * hue. Both axes are applied synchronously before first paint (see bottom of
 * file) so a reload restores the saved look with no flash.
 */

type Theme = 'light' | 'dark' | 'system';

export type ComboKey = 'emerald-slate-snow' | 'cyan-obsidian' | 'amber-obsidian' | 'violet-graphite-pearl';

type Palette = Record<'50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | '950', string>;
type Gradient = readonly [from: string, via: string, to: string];

interface Combo {
    label: string;
    /** 11-shade accent palette that overrides `--color-emerald-*`. */
    accent: Palette;
    gradient: { light: Gradient; dark: Gradient };
}

/**
 * The single source of truth for every colour scheme. `emerald-slate-snow` is
 * the brand default and must stay exactly as-is.
 */
export const COMBOS: Record<ComboKey, Combo> = {
    'emerald-slate-snow': {
        label: 'Emerald Slate Snow',
        accent: {
            '50': '#ecfdf5', '100': '#d1fae5', '200': '#a7f3d0', '300': '#6ee7b7', '400': '#34d399',
            '500': '#10b981', '600': '#059669', '700': '#047857', '800': '#065f46', '900': '#064e3b', '950': '#022c22',
        },
        gradient: { light: ['#f8fafc', '#f1f5f9', '#e0e7ff'], dark: ['#020617', '#0f172a', '#1e2937'] },
    },
    // Turquoise — bright sparkle kept in the light shades (300/400), while the
    // action shade (500) is a deep teal-turquoise that holds white text (~3.8:1).
    'cyan-obsidian': {
        label: 'Cyan Obsidian',
        accent: {
            '50': '#f0fdfa', '100': '#ccfbf1', '200': '#99f6e4', '300': '#5eead4', '400': '#2dd4bf',
            '500': '#0d9488', '600': '#0a7d72', '700': '#0c645c', '800': '#0d4f49', '900': '#0b3e3a', '950': '#042a27',
        },
        gradient: { light: ['#f0fdfa', '#e6fbf6', '#d7f5ee'], dark: ['#08120f', '#0b1714', '#10211c'] },
    },
    // Orange — warm pumpkin/amber. Action shade (500) deepened so white reads
    // (~3.6:1 on bold) instead of the old neon-yellow that washed out.
    'amber-obsidian': {
        label: 'Amber Chocolate',
        accent: {
            '50': '#fff7ed', '100': '#ffedd5', '200': '#fdd9b5', '300': '#fbbe85', '400': '#f99c4e',
            '500': '#ea580c', '600': '#cf4a09', '700': '#ab3c0c', '800': '#87310f', '900': '#6e2912', '950': '#401405',
        },
        gradient: { light: ['#fff7ed', '#fff1e0', '#ffe8cf'], dark: ['#1a120b', '#1f160d', '#2a1c10'] },
    },
    // Violet — royal "ink" purple. Action shade (500) is rich and white-readable
    // (~5.7:1) with soft pearl tints for badges/hover.
    'violet-graphite-pearl': {
        label: 'Violet Ink',
        accent: {
            '50': '#f5f3ff', '100': '#ede9fe', '200': '#ddd6fe', '300': '#c4b5fd', '400': '#a78bfa',
            '500': '#7c3aed', '600': '#6d28d9', '700': '#5b21b6', '800': '#4c1d95', '900': '#3b1576', '950': '#250d4d',
        },
        gradient: { light: ['#faf5ff', '#f5edff', '#ece0ff'], dark: ['#120c1f', '#171026', '#201634'] },
    },
};

/** Picker metadata derived from COMBOS: label, accent colour and both gradients. */
export const COMBO_LIST = (Object.keys(COMBOS) as ComboKey[]).map((key) => ({
    key,
    label: COMBOS[key].label,
    accent: COMBOS[key].accent['500'],
    gradient: COMBOS[key].gradient,
}));

const DEFAULT_COMBO: ComboKey = 'emerald-slate-snow';
const STORAGE = { theme: 'theme', combo: 'combo-key' } as const;

// --- Pure helpers -----------------------------------------------------------

function readTheme(): Theme {
    const v = localStorage.getItem(STORAGE.theme);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function readCombo(): ComboKey {
    const v = localStorage.getItem(STORAGE.combo) as ComboKey | null;
    return v && v in COMBOS ? v : DEFAULT_COMBO;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
    if (theme !== 'system') return theme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Apply a combo's accent palette + background gradient to the document root. */
function applyCombo(key: ComboKey, isDark: boolean) {
    if (typeof document === 'undefined') return;
    const { accent, gradient } = COMBOS[key] ?? COMBOS[DEFAULT_COMBO];
    const root = document.documentElement;

    for (const shade of Object.keys(accent) as (keyof Palette)[]) {
        root.style.setProperty(`--color-emerald-${shade}`, accent[shade]);
    }
    const [from, via, to] = isDark ? gradient.dark : gradient.light;
    root.style.setProperty('--grad-from', from);
    root.style.setProperty('--grad-via', via);
    root.style.setProperty('--grad-to', to);
}

async function syncStatusBar(key: ComboKey, isDark: boolean) {
    if (!Capacitor.isNativePlatform()) return;
    try {
        await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
        if (Capacitor.getPlatform() === 'android') {
            const { gradient } = COMBOS[key] ?? COMBOS[DEFAULT_COMBO];
            await StatusBar.setBackgroundColor({ color: (isDark ? gradient.dark : gradient.light)[0] });
        }
    } catch (e) {
        console.warn(e);
    }
}

// First paint: restore the saved theme + combo synchronously so there's no flash
// and the accent persists across reloads.
if (typeof document !== 'undefined') {
    const isDark = resolveTheme(readTheme()) === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    applyCombo(readCombo(), isDark);
}

// --- Provider ---------------------------------------------------------------

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
    comboKey: ComboKey;
    setComboKey: (key: ComboKey) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(readTheme);
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(readTheme()));
    const [comboKey, setComboKeyState] = useState<ComboKey>(readCombo);

    const setTheme = useCallback((next: Theme) => {
        localStorage.setItem(STORAGE.theme, next);
        setThemeState(next);
    }, []);

    const setComboKey = useCallback((next: ComboKey) => {
        localStorage.setItem(STORAGE.combo, next);
        setComboKeyState(next);
    }, []);

    // Resolve light/dark (incl. live system changes) and toggle the `.dark` class.
    useEffect(() => {
        const apply = () => setResolvedTheme(resolveTheme(theme));
        apply();
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [theme]);

    // Paint accent + gradient + the `.dark` class before the browser shows the
    // frame, whenever the scheme or resolved mode changes.
    useLayoutEffect(() => {
        document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
        applyCombo(comboKey, resolvedTheme === 'dark');
    }, [comboKey, resolvedTheme]);

    // Native status bar follows the scheme (non-visual on web).
    useEffect(() => {
        syncStatusBar(comboKey, resolvedTheme === 'dark');
    }, [comboKey, resolvedTheme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, comboKey, setComboKey }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
