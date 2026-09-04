const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
    const { data, error } = await supabase.from('tickets').select('id, ticket_comments(count)').limit(2);
    console.log(JSON.stringify(data, null, 2));
}
test();
