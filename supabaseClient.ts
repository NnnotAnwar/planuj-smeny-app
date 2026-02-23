import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublisherKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublisherKey) {
    throw new Error('No supabase API keys, create .env.local');
}

export const supabase = createClient(supabaseUrl, supabasePublisherKey);