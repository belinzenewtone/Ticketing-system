import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL =
  'postgresql://postgres.xijallewiocustcogmeh:Belinze%401738.@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const migrationsDir = path.join(process.cwd(), 'migrations');

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Supabase Postgres\n');

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await client.query(sql);
      console.log(`✅ ${file}`);
    } catch (err) {
      // Already applied or harmless conflict
      if (err.code === '42P07' || err.code === '42710') {
        console.log(`⏭  ${file} (already applied)`);
      } else {
        console.error(`❌ ${file}: ${err.message}`);
      }
    }
  }

  await client.end();
  console.log('\n🎉 All migrations done!');
}

run().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
