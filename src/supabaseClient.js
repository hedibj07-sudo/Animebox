import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs sont faites pour être utilisées côté navigateur
// (ce ne sont PAS des secrets) — c'est la "Publishable key" de ton
// projet Supabase, protégée par les règles RLS de la base de données.
const SUPABASE_URL = "https://hqkteskawkcxnbwldurp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable__gmS3t4TSTz2QtnRlj6U_g_3iUSlhgV";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
