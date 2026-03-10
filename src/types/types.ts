export type Shift = {
  id: string;
  user_id: string;
  location_id: string;
  organization_id: string;
  started_at: string;
  ended_at: string | null;
  role: string;
  profiles?: {
    username: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

export type User = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  organization_id: string;
};

export type ShiftDisplayData = {
  id?: string;
  name: string;
  role: string;
  start: string;
  end: string | null;
  isChangeLocation?: boolean;
};

export type Location = {
  id: string;
  name: string;
  shifts?: Shift[];
  organization_id?: string;
};