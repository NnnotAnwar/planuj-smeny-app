const ROLE_COLORS: Record<string, string> = {
    Manager: 'bg-purple-600 text-white',
    Supervisor: 'bg-emerald-500 text-white',
    Employee: 'bg-lime-400 text-white',
    Superadmin: 'bg-red-900 text-white',
};

export function getRoleBadgeColor(role: string): string {
    return ROLE_COLORS[role] || 'bg-red-100 text-red-700';
}