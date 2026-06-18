// One consistent badge treatment for every role — a soft tinted pill (light
// surface + colored text in light mode, translucent + bright text in dark).
// Only the hue changes per rank, so the set reads as a unified palette.
// NOTE: keep these as full literal class strings so Tailwind can detect them.
const ROLE_COLORS: Record<string, string> = {
    Superadmin: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
    'Head Admin': 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    Admin: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
    Manager: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    Supervisor: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    Employee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const FALLBACK = 'bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300';

export function getRoleBadgeColor(role: string): string {
    return ROLE_COLORS[role] || FALLBACK;
}
