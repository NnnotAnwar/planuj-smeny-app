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

    // Common
    'common.toggleTheme': 'Toggle theme',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.saving': 'Saving…',
    'common.loading': 'Loading…',
    'common.retry': 'Try again',

    // Auth
    'auth.welcomeBack': 'Welcome back',
    'auth.portal': 'Planuj Směny · Employee Portal',
    'auth.emailOrUsername': 'Email or username',
    'auth.password': 'Password',
    'auth.showPassword': 'Show password',
    'auth.hidePassword': 'Hide password',
    'auth.invalidCredentials': 'Invalid email/username or password.',
    'auth.signIn': 'Sign in',
    'auth.signingIn': 'Signing in…',

    // Shifts / Home
    'shifts.start': 'Start Shift',
    'shifts.starting': 'Starting…',
    'shifts.selectLocation': 'Select a location to start',
    'shifts.end': 'End Shift',
    'shifts.ending': 'Ending…',
    'shifts.active': 'Active Shift',
    'shifts.noActive': 'No Active Shift',
    'shifts.yourShift': 'Your shift',
    'shifts.moved': 'Moved',
    'shifts.movedFrom': 'Moved from {location}',
    'shifts.startedAt': 'Started at {time}',
    'shifts.unknownLocation': 'Unknown location',

    // Locations
    'location.startAt': 'Start your shift at',
    'location.moveTo': 'Move your shift to',
    'location.confirm': 'Confirm',
    'location.showAll': 'Show All (+{count})',
    'location.showLess': 'Show Less',
    'location.alreadyHere': "You're already here",
    'location.workingAt': 'Working at {location}',

    // About / Support / Legal
    'settings.about': 'About',
    'settings.about.app': 'App',
    'settings.support': 'Contact support',
    'settings.support.hint': 'Questions or problems? We usually reply within a day.',
    'settings.privacy': 'Privacy Policy',
    'settings.terms': 'Terms of Service',
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

    'settings.about': 'O aplikaci',
    'settings.about.app': 'Aplikace',
    'settings.support': 'Kontaktovat podporu',
    'settings.support.hint': 'Dotazy nebo potíže? Obvykle odpovídáme do jednoho dne.',
    'settings.privacy': 'Zásady ochrany osobních údajů',
    'settings.terms': 'Podmínky použití',

    'common.toggleTheme': 'Přepnout motiv',
    'common.cancel': 'Zrušit',
    'common.save': 'Uložit',
    'common.saving': 'Ukládání…',
    'common.loading': 'Načítání…',
    'common.retry': 'Zkusit znovu',

    'auth.welcomeBack': 'Vítejte zpět',
    'auth.portal': 'Planuj Směny · Zaměstnanecký portál',
    'auth.emailOrUsername': 'E-mail nebo uživatelské jméno',
    'auth.password': 'Heslo',
    'auth.showPassword': 'Zobrazit heslo',
    'auth.hidePassword': 'Skrýt heslo',
    'auth.invalidCredentials': 'Neplatný e-mail/uživatelské jméno nebo heslo.',
    'auth.signIn': 'Přihlásit se',
    'auth.signingIn': 'Přihlašování…',

    'shifts.start': 'Začít směnu',
    'shifts.starting': 'Spouštění…',
    'shifts.selectLocation': 'Pro zahájení vyberte místo',
    'shifts.end': 'Ukončit směnu',
    'shifts.ending': 'Ukončování…',
    'shifts.active': 'Aktivní směna',
    'shifts.noActive': 'Žádná aktivní směna',
    'shifts.yourShift': 'Vaše směna',
    'shifts.moved': 'Přesunuto',
    'shifts.movedFrom': 'Přesunuto z {location}',
    'shifts.startedAt': 'Začátek v {time}',
    'shifts.unknownLocation': 'Neznámé místo',

    'location.startAt': 'Začít směnu na',
    'location.moveTo': 'Přesunout směnu na',
    'location.confirm': 'Potvrdit',
    'location.showAll': 'Zobrazit vše (+{count})',
    'location.showLess': 'Zobrazit méně',
    'location.alreadyHere': 'Už jste tady',
    'location.workingAt': 'Pracujete na {location}',
};

export const translations = { en, cs };
export type Language = keyof typeof translations;
export const LANGUAGES: { code: Language; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'cs', label: 'Čeština' },
];
