// Supabase Initialization for Real-time Scoring Relay
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm";
import { supabaseConfig } from './project-config.js';

const supabaseUrl = supabaseConfig.url;
const supabaseKey = supabaseConfig.anonKey;

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("[SUPABASE] Initialized Relay Service");

/**
 * Push scoring update to Supabase Realtime Table
 * @param {string} tatamiId - Tatami identifier
 * @param {Object} data - Scoring data to broadcast
 */
export async function pushToSupabase(tatamiId, data) {
    try {
        // We use an 'upsert' to a 'live_scores' table
        // This table should have 'tatami_id' as primary key
        const { error } = await supabase
            .from('live_scores')
            .upsert({
                tatami_id: tatamiId,
                data: data,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    } catch (err) {
        console.error("[SUPABASE] Relay Error:", err.message);
    }
}
