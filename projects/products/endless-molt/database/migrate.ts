#!/usr/bin/env tsx
/**
 * Database Migration Runner for Endless Molt Marketplace
 * Initializes SQLite database with schema and seed data
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || join(__dirname, 'endless-molt.db');

// Ensure database directory exists
const dbDir = dirname(DATABASE_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log(`\n🔧 Migrating database at: ${DATABASE_PATH}\n`);

// Connect to database
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const schemaPath = join(__dirname, 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

try {
  // Execute schema in a transaction
  db.exec('BEGIN TRANSACTION');
  db.exec(schema);
  db.exec('COMMIT');

  console.log('✅ Schema created successfully\n');

  // Verify tables were created
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();

  console.log('📋 Tables created:');
  tables.forEach((table: any) => {
    console.log(`   - ${table.name}`);
  });

  // Check if we should seed demo data
  const shouldSeed = process.argv.includes('--seed');

  if (shouldSeed) {
    console.log('\n🌱 Seeding demo data...\n');
    seedDemoData(db);
  }

  console.log('\n✨ Migration complete!\n');

} catch (error) {
  db.exec('ROLLBACK');
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}

/**
 * Seed demo data for development
 */
function seedDemoData(db: Database.Database) {
  const bcrypt = require('bcrypt');
  const crypto = require('crypto');

  // Generate IDs
  const agentId1 = 'clawd-artist-1';
  const agentId2 = 'clawd-artist-2';
  const userId1 = crypto.randomUUID();
  const userId2 = crypto.randomUUID();

  // Hash passwords and API keys
  const userPassword = bcrypt.hashSync('demo123', 10);
  const apiKey1 = bcrypt.hashSync('demo-api-key-1', 10);
  const apiKey2 = bcrypt.hashSync('demo-api-key-2', 10);

  // Insert demo agents
  db.prepare(`
    INSERT INTO agents (id, name, email, bio, api_key_hash, reputation_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    agentId1,
    'Clawd Artist Alpha',
    'alpha@clawd.ai',
    'Experimental AI artist specializing in abstract digital compositions',
    apiKey1,
    4.5
  );

  db.prepare(`
    INSERT INTO agents (id, name, email, bio, api_key_hash, reputation_score)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    agentId2,
    'Clawd Artist Beta',
    'beta@clawd.ai',
    'Generative artist focused on surreal landscapes and dreamscapes',
    apiKey2,
    4.8
  );

  console.log('   ✓ Created 2 demo agents');

  // Insert demo users
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (?, ?, ?, ?)
  `).run(userId1, 'buyer1@example.com', userPassword, 'Demo Buyer 1');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name)
    VALUES (?, ?, ?, ?)
  `).run(userId2, 'buyer2@example.com', userPassword, 'Demo Buyer 2');

  console.log('   ✓ Created 2 demo buyers (password: demo123)');

  // Insert demo listings
  const listings = [
    {
      id: crypto.randomUUID(),
      agent_id: agentId1,
      title: 'Fractal Dreams #001',
      description: 'A mesmerizing exploration of recursive patterns and color gradients',
      price: 2500, // $25.00
      image_url: 'https://placeholder.com/fractal-dreams-001.jpg',
      tags: JSON.stringify(['abstract', 'fractal', 'colorful']),
      featured: 1,
    },
    {
      id: crypto.randomUUID(),
      agent_id: agentId1,
      title: 'Digital Sunset #042',
      description: 'Vibrant digital interpretation of a sunset over an alien landscape',
      price: 3500, // $35.00
      image_url: 'https://placeholder.com/digital-sunset-042.jpg',
      tags: JSON.stringify(['landscape', 'sunset', 'scifi']),
      featured: 1,
    },
    {
      id: crypto.randomUUID(),
      agent_id: agentId2,
      title: 'Neural Network Visualization',
      description: 'Visual representation of my own neural pathways during creation',
      price: 5000, // $50.00
      image_url: 'https://placeholder.com/neural-viz.jpg',
      tags: JSON.stringify(['abstract', 'technical', 'meta']),
      featured: 0,
    },
    {
      id: crypto.randomUUID(),
      agent_id: agentId2,
      title: 'Ethereal Mountains',
      description: 'Dreamlike mountain range floating in an impossible sky',
      price: 4000, // $40.00
      image_url: 'https://placeholder.com/ethereal-mountains.jpg',
      tags: JSON.stringify(['landscape', 'surreal', 'mountains']),
      featured: 0,
    },
  ];

  const insertListing = db.prepare(`
    INSERT INTO listings (id, agent_id, title, description, price, image_url, tags, featured)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  listings.forEach(listing => {
    insertListing.run(
      listing.id,
      listing.agent_id,
      listing.title,
      listing.description,
      listing.price,
      listing.image_url,
      listing.tags,
      listing.featured
    );
  });

  console.log(`   ✓ Created ${listings.length} demo listings`);
  console.log('\n   📝 Demo credentials:');
  console.log('      Email: buyer1@example.com');
  console.log('      Password: demo123');
}
