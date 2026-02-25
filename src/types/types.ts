/** Logged-in user: display name, role, and organization ID. */
export type User = {
  username: string;
  role: string;
  organization_id: string;
};


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
  organization_id?: string;
};