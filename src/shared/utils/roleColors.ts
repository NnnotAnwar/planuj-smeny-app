const ROLE_COLORS: Record<string, string> = {
    Superadmin: 'bg-red-900 text-white',
    'Head Admin': 'bg-amber-500 text-white',
    Admin: 'bg-red-500 text-white',
    Manager: 'bg-purple-600 text-white',
    Supervisor: 'bg-blue-500 text-white',
    Employee: 'bg-lime-400 text-white',
};

export function getRoleBadgeColor(role: string): string {
    return ROLE_COLORS[role] || 'bg-red-100 text-red-700';
}