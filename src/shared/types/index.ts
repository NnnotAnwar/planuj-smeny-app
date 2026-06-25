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
  email: z.email(),
  role: z.object({
    name: z.string(),
    is_admin: z.boolean(),
    rank: z.number().default(0), // Position in the role hierarchy (higher = more privileged)
  }),
  organization_id: z.string(), // The company this user belongs to
  username_changed_at: z.string().nullable().optional(), // last username change (7-day self-service limit)
});

/**
 * NameChangeRequestSchema: an employee's request to change their first/last name.
 * Staff (rank < 30) cannot edit their own name directly — they file one of these
 * and an admin approves it (which applies the new name automatically).
 */
export const NameChangeRequestSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  organization_id: z.string(),
  current_first_name: z.string().nullable(),
  current_last_name: z.string().nullable(),
  requested_first_name: z.string().nullable(),
  requested_last_name: z.string().nullable(),
  note: z.string().nullable().optional(),
  review_note: z.string().nullable().optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  reviewed_at: z.string().nullable().optional(),
  created_at: z.string(),
  // Embedded requester profile (admin list view).
  requester: z
    .object({
      username: z.string(),
      email: z.email().nullable().optional(),
      first_name: z.string().nullable().optional(),
      last_name: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

/** Lightweight worker profile embedded in joined shift rows (the live board). */
export const ShiftProfileSchema = z.object({
  username: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable()
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
  // Optional profile info that we often "join" in the query (own active shift omits it).
  profiles: ShiftProfileSchema.optional().nullable()
});

/**
 * Board rows (other colleagues' active shifts) always carry the joined profile,
 * so we validate that the embed is present rather than leaving it optional.
 */
export const ShiftWithProfileSchema = ShiftSchema.extend({
  profiles: ShiftProfileSchema.nullable()
});

/** 
 * LocationSchema: Defines what a physical work location looks like.
 */
export const LocationSchema = z.object({
  id: z.string(), // Unique location ID
  name: z.string(), // Name of the restaurant/office
  organization_id: z.string().optional(),
  organizationName: z.string().optional(),
  archived_at: z.string().nullable().optional(), // soft-delete: hidden from pickers, history kept
});

/**
 * OrganizationSchema: Defines a organizations that is connected to app
 */
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().optional(),
  locations: z.array(z.object(
    {
      id: z.string(),
      name: z.string(),
      organization_id: z.string(),
      archived_at: z.string().nullable().optional()
    }
  )),
  profiles: z.array(z.object({
    id: z.string(),
    role: z.object({
      name: z.string(),
      is_admin: z.boolean(),
      rank: z.number().default(0)
    }),
    email: z.email(),
    username: z.string(),
    first_name: z.string().nullable(),
    last_name: z.string().nullable(),
    organization_id: z.string()
  }))
})


/**
 * RoleSchema: Defines a selectable role (from the `roles` table).
 * Used by the admin panel to assign/change an employee's role.
 */
export const RoleSchema = z.object({
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
  is_admin: z.boolean(),
  rank: z.number().default(0),
});

/**
 * A point-in-time snapshot of a shift's editable fields, stored inside an audit
 * entry's `details` so the log stays readable even after the shift/location is
 * removed.
 */
export const ShiftSnapshotSchema = z.object({
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
  location_id: z.string().nullable().optional(),
  location_name: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
});

/**
 * ShiftAuditLogSchema: one administrative change to a member's shift
 * (create/update/delete), recorded by the SECURITY DEFINER RPCs. Admins+ can
 * review these; `details` snapshots names + before/after values.
 */
export const ShiftAuditLogSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  shift_id: z.string().nullable(),
  actor_id: z.string().nullable(),
  target_user_id: z.string().nullable(),
  action: z.enum(['create', 'update', 'delete']),
  details: z
    .object({
      actor_name: z.string().nullable().optional(),
      target_name: z.string().nullable().optional(),
      old: ShiftSnapshotSchema.nullable().optional(),
      new: ShiftSnapshotSchema.nullable().optional(),
    })
    .default({}),
  created_at: z.string(),
});

/**
 * --- TYPES FOR TYPESCRIPT ---
 * These are generated automatically from the schemas above.
 * We use these throughout the app to get auto-completion and error checking.
 */
export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileDetail = Profile & { organizationName?: string | null };
export type Shift = z.infer<typeof ShiftSchema>;
export type ShiftWithProfile = z.infer<typeof ShiftWithProfileSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Organization = z.infer<typeof OrganizationSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type NameChangeRequest = z.infer<typeof NameChangeRequestSchema>;
export type ShiftSnapshot = z.infer<typeof ShiftSnapshotSchema>;
export type ShiftAuditLog = z.infer<typeof ShiftAuditLogSchema>;

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
