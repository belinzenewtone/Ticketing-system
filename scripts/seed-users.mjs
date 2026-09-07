import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL =
  'postgresql://postgres.xijallewiocustcogmeh:Belinze%401738.@aws-1-eu-central-1.pooler.supabase.com:6543/postgres';

const users = [
  { email: 'admin@jtl.co.ke', name: 'Admin',      role: 'ADMIN', password: 'Belinze@1738.' },
  { email: 'user@jtl.co.ke',  name: 'Portal User', role: 'USER',  password: 'Belinze@1738.' },
];

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('✅ Connected to Supabase Postgres');

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 12);
    const id     = crypto.randomUUID();
    const now    = new Date().toISOString();

    // Upsert — safe to run multiple times
    await client.query(
      `INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (email) DO UPDATE
         SET password  = EXCLUDED.password,
             role      = EXCLUDED.role,
             "updatedAt" = EXCLUDED."updatedAt"`,
      [id, u.name, u.email, hashed, u.role, now]
    );

    console.log(`✅ Upserted: ${u.email}  role=${u.role}`);
  }

  await client.end();
  console.log('\n🎉 Done! You can now sign in with:');
  console.log('   admin@jtl.co.ke  /  Belinze@1738.');
  console.log('   user@jtl.co.ke   /  Belinze@1738.');
}

seed().catch(err => { console.error('❌', err.message); process.exit(1); });
