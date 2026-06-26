/**
 * --- TRANSLATIONS ---
 * Flat key → string dictionaries. `en` is the source of truth; every other
 * locale must provide the same keys (enforced by the `Record<TranslationKey…>`
 * type below). Interpolation uses `{name}`-style placeholders.
 *
 * Coverage is incremental — screens are migrated to `t()` over time; anything
 * not yet translated simply renders its English source via the fallback.
 */
export const en = {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.home': 'Home',
    'nav.overview': 'Overview',
    'nav.admin': 'Admin',
    'nav.adminPanel': 'Admin Panel',
    'nav.timesheets': 'Timesheets',
    'nav.requests': 'Requests',
    'nav.activity': 'Activity Log',
    'nav.settings': 'Settings',
    'nav.profile': 'Profile',
    'nav.more': 'More',
    'nav.menu': 'Menu',
    'nav.logout': 'Log out',

    // Dashboard
    'dashboard.greeting': 'Hello, {name}!',

    // Settings
    'settings.preferences': 'Preferences',
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.darkMode': 'Dark mode',
    'settings.theme': 'Theme',
    'settings.theme.system': 'System',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.colorScheme': 'Color scheme',
    'settings.colorScheme.hint': 'Sets the accent color and background across the app.',
    'settings.language': 'Language',
    'settings.timeFormat': 'Time format',
    'settings.timeFormat.12h': '12-hour',
    'settings.timeFormat.24h': '24-hour',
    'settings.timeFormat.hint': 'How times appear across shifts and timesheets.',
    'settings.defaultLocation': 'Default clock-in location',
    'settings.defaultLocation.none': 'No default',
    'settings.defaultLocation.hint': 'Pre-selected when you open the app to start a shift.',
    'settings.version': 'Version {version} • {year}',
} as const;

export type TranslationKey = keyof typeof en;

export const cs: Record<TranslationKey, string> = {
    'nav.dashboard': 'Přehled',
    'nav.home': 'Domů',
    'nav.overview': 'Přehled',
    'nav.admin': 'Správa',
    'nav.adminPanel': 'Administrace',
    'nav.timesheets': 'Výkazy',
    'nav.requests': 'Žádosti',
    'nav.activity': 'Protokol aktivit',
    'nav.settings': 'Nastavení',
    'nav.profile': 'Profil',
    'nav.more': 'Více',
    'nav.menu': 'Menu',
    'nav.logout': 'Odhlásit se',

    'dashboard.greeting': 'Dobrý den, {name}!',

    'settings.preferences': 'Předvolby',
    'settings.title': 'Nastavení',
    'settings.appearance': 'Vzhled',
    'settings.darkMode': 'Tmavý režim',
    'settings.theme': 'Motiv',
    'settings.theme.system': 'Systém',
    'settings.theme.light': 'Světlý',
    'settings.theme.dark': 'Tmavý',
    'settings.colorScheme': 'Barevné schéma',
    'settings.colorScheme.hint': 'Nastaví barvu zvýraznění a pozadí v celé aplikaci.',
    'settings.language': 'Jazyk',
    'settings.timeFormat': 'Formát času',
    'settings.timeFormat.12h': '12hodinový',
    'settings.timeFormat.24h': '24hodinový',
    'settings.timeFormat.hint': 'Jak se zobrazuje čas u směn a výkazů.',
    'settings.defaultLocation': 'Výchozí místo pro příchod',
    'settings.defaultLocation.none': 'Bez výchozího',
    'settings.defaultLocation.hint': 'Předvybráno při otevření aplikace pro zahájení směny.',
    'settings.version': 'Verze {version} • {year}',
};

export const translations = { en, cs };
export type Language = keyof typeof translations;
export const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'cs', label: 'Čeština' },
];
