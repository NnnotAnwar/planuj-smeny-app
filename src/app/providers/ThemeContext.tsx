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
    'cyan-obsidian': {
        label: 'Cyan Obsidian',
        accent: {
            '50': '#ecfeff', '100': '#cffafe', '200': '#a5f3fc', '300': '#67e8f9', '400': '#22d3ee',
            '500': '#00F5D4', '600': '#00b8a0', '700': '#008f7a', '800': '#006b5c', '900': '#004d44', '950': '#002e2a',
        },
        gradient: { light: ['#e0f2fe', '#f0f9ff', '#dbeafe'], dark: ['#0D0E15', '#12131A', '#1C1D25'] },
    },
    'amber-obsidian': {
        label: 'Amber Chocolate',
        accent: {
            '50': '#fffbeb', '100': '#fff3d1', '200': '#ffe9a8', '300': '#ffdc72', '400': '#ffcf3d',
            '500': '#FFB703', '600': '#e69c00', '700': '#c27f00', '800': '#9c6500', '900': '#714a00', '950': '#3f2900',
        },
        gradient: { light: ['#f8f1e3', '#f5e9d8', '#f0e1cc'], dark: ['#161412', '#1b1714', '#211d19'] },
    },
    'violet-graphite-pearl': {
        label: 'Violet Ink',
        accent: {
            '50': '#f5f0ff', '100': '#ede0ff', '200': '#e0c8ff', '300': '#c89eff', '400': '#b57ae8',
            '500': '#9D4EDD', '600': '#7c3bb8', '700': '#5e2a8f', '800': '#4a216f', '900': '#381b54', '950': '#221035',
        },
        gradient: { light: ['#f5f0ff', '#f0e8ff', '#e9d9ff'], dark: ['#0F0C1B', '#13101F', '#1A1629'] },
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
