// config/supabase.js
// Extracted from L9-12 of index.js
const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
} else {
  // Supabase not configured; continuing with PostgreSQL / S3
}

module.exports = supabaseAdmin;
