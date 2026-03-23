import { createClient } from '@supabase/supabase-js';

/**
 * --- SUPABASE CLIENT ---
 * This file sets up the connection to the Supabase backend.
 * We use 'import.meta.env' to read values from the .env file.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublisherKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Fail fast if environment variables are missing.
if (!supabaseUrl) {
    throw new Error('MISSING: VITE_SUPABASE_URL environment variable.');
}
if (!supabasePublisherKey) {
    throw new Error('MISSING: VITE_SUPABASE_PUBLISHABLE_KEY environment variable.');
}

// Ensure the URL is valid.
try {
    new URL(supabaseUrl);
} catch (e) {
    throw new Error(`INVALID: VITE_SUPABASE_URL "${supabaseUrl}" is not a valid URL.`);
}

export const supabase = createClient(supabaseUrl, supabasePublisherKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});
