import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pwsgbfpyyklzxyqjdtpi.supabase.co';
const supabaseKey = 'sb_publishable_7qo2QV64n-1CSLFTk4hRFg_T5kf-zdP';

export const supabase = createClient(supabaseUrl, supabaseKey);
