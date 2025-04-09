import { db } from './db';
import { sql } from 'drizzle-orm';

async function migrate() {
  console.log('Running migrations...');

  try {
    // Create new tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        content TEXT NOT NULL,
        ar_filter_applied BOOLEAN DEFAULT FALSE,
        filter_data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS privacy (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) UNIQUE,
        profile_visibility TEXT DEFAULT 'public',
        story_visibility TEXT DEFAULT 'all',
        last_seen_visibility TEXT DEFAULT 'all',
        message_permission TEXT DEFAULT 'all',
        data_usage_consent BOOLEAN DEFAULT TRUE
      );

      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        contact_id INTEGER NOT NULL REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS filters (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        configuration JSONB NOT NULL,
        preview_url TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
      );
    `);

    // Alter existing tables
    await db.execute(sql`
      -- Update users table
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'online',
      ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

      -- Update posts table
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS ar_filter TEXT,
      ADD COLUMN IF NOT EXISTS filter_data JSONB;

      -- Update stories table
      ALTER TABLE stories
      ADD COLUMN IF NOT EXISTS ar_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS vr_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS filter_data JSONB;

      -- Update settings table
      ALTER TABLE settings
      ADD COLUMN IF NOT EXISTS real_time_updates BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS ar_vr_features BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS message_encryption BOOLEAN DEFAULT TRUE;
    `);

    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration
migrate().catch(console.error);