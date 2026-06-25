export const getFullInitials = (firstName?: string | null, lastName?: string | null) => {
    const f = firstName?.trim().charAt(0) || '';
    const l = lastName?.trim().charAt(0) || '';
    const initials = (f + l).toUpperCase();
    return initials || '?';
};

/**
 * Build a person's display name from first/last name, falling back to their
 * `@username` when no name is set. Shared by the profile page, the employee
 * profile modal and any list that shows a person's full name.
 */
export const getFullName = (
    person: { first_name?: string | null; last_name?: string | null; username: string },
) => {
    const full = `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
    return full || person.username;
};