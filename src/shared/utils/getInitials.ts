export const getFullInitials = (firstName?: string | null, lastName?: string | null) => {
    const f = firstName?.trim().charAt(0) || '';
    const l = lastName?.trim().charAt(0) || '';
    const initials = (f + l).toUpperCase();
    return initials || '?';
};