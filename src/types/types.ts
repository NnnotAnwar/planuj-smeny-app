export type User = {
    username: string;
    role: string;
};

export type Shift = {
    id: number;
    name: string;
    role: string;
    start: string | null;
    end: string | null;
};

export type Location = {
    id: string;
    name: string;
    shifts: Shift[];
};