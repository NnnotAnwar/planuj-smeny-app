import { z } from 'zod';

/**
 * --- WHAT ARE SCHEMAS? ---
 * Schemas are used to VALIDATE the data we get from the database (Supabase).
 * We use a library called 'Zod' to make sure the data matches what we expect.
 * This prevents bugs if the database structure changes.
 */

/** 
 * ProfileSchema: Defines what a user profile looks like.
 */
export const ProfileSchema = z.object({
  id: z.string(), // Unique user ID
  username: z.string(), // Display username
  first_name: z.string().nullable(), // Optional first name
  last_name: z.string().nullable(), // Optional last name
  role: z.string(), // User's job role (e.g., Manager, Waiter)
  organization_id: z.string(), // The company this user belongs to
});

/** 
 * ShiftSchema: Defines what a shift record looks like.
 */
export const ShiftSchema = z.object({
  id: z.string(), // Unique shift ID
  user_id: z.string(), // Who worked this shift
  location_id: z.string(), // Where they worked
  previous_location_id: z.string().nullable().optional(), // Where they moved from
  organization_id: z.string(), // Company ID
  started_at: z.string(), // ISO date string of when it started
  ended_at: z.string().nullable(), // ISO date string or null if still working
  role: z.string(), // The role they worked during this shift
  isChangeLocation: z.boolean().optional(), // UI flag to indicate location change
  // Optional profile info that we often "join" in the query
  profiles: z.object({
    username: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable()
  }).optional().nullable()
});

/** 
 * LocationSchema: Defines what a physical work location looks like.
 */
export const LocationSchema = z.object({
  id: z.string(), // Unique location ID
  name: z.string(), // Name of the restaurant/office
  organization_id: z.string().optional(),
});

/**
 * --- TYPES FOR TYPESCRIPT ---
 * These are generated automatically from the schemas above.
 * We use these throughout the app to get auto-completion and error checking.
 */
export type Profile = z.infer<typeof ProfileSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type Location = z.infer<typeof LocationSchema>;

/**
 * --- COMPONENT TYPES ---
 * These types are specific to how we show data in the UI (User Interface).
 */

/** Used for the profile of the current logged-in user */
export type User = Profile;

/** Simplified shift data used in the ShiftCards components */
export type ShiftDisplayData = {
  id?: string;
  name: string;
  role: string;
  start: string;
  end: string | null;
  isChangeLocation?: boolean;
  previousLocationName?: string; // New field to show where the user moved from.
};
