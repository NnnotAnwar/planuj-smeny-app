import type { ShiftTemplate } from './types';

/** Templates per organization (also enforced by a DB trigger) — they become
 *  buttons across the rota, so the list has to stay short. */
export const MAX_TEMPLATES = 8;

/** HH:MM of a template's stored time (HH:MM[:SS]). */
export const tplTime = (t: string) => t.slice(0, 5);

/** The template with exactly these times, if one exists. */
export const templateFor = (templates: ShiftTemplate[], start: string, end: string) =>
    templates.find((tpl) => tplTime(tpl.start_time) === start && tplTime(tpl.end_time) === end);
