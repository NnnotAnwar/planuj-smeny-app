/** Logged-in user: display name and role (e.g. Supervisor, Admin). */
export type User = {
  username: string;
  role: string;
};

/** Single shift: employee, role, and optional start/end times (null = unset). */
export type Shift = {
  id: number;
  name: string;
  role: string;
  start: string | null;
  end: string | null;
};

/** Restaurant location with id, name, and list of shifts. */
export type Location = {
  id: string | null;
  name: string;
  shifts: Shift[];
};
