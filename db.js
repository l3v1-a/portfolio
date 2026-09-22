const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'levi.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      subcategory TEXT,
      year INTEGER,
      client TEXT,
      client_visibility TEXT DEFAULT 'public',
      featured INTEGER NOT NULL DEFAULT 0,
      thumbnail_url TEXT,
      poster_url TEXT,
      video_url TEXT,
      video_hosting TEXT DEFAULT 'self',
      video_privacy TEXT DEFAULT 'public',
      description TEXT,
      objective TEXT,
      role TEXT,
      editing_approach TEXT,
      tools TEXT,
      duration TEXT,
      timeline_json TEXT,
      markers_json TEXT,
      raw_footage_url TEXT,
      before_url TEXT,
      after_url TEXT,
      breakdown_json TEXT,
      editing_dna TEXT,
      gallery_json TEXT,
      cta_label TEXT DEFAULT 'Start a Project',
      cta_url TEXT DEFAULT '#contact',
      seo_title TEXT,
      seo_description TEXT,
      og_image TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      publish_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      tools TEXT,
      deliverables_json TEXT,
      featured_project_slug TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS pricing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price TEXT,
      currency TEXT DEFAULT 'INR',
      deliverables_json TEXT,
      revisions TEXT,
      turnaround TEXT,
      features_json TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      availability TEXT,
      cta_label TEXT DEFAULT 'Start a Project',
      sort_order INTEGER NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      project_type TEXT,
      service TEXT,
      budget TEXT,
      deadline TEXT,
      video_duration TEXT,
      platform TEXT,
      audience TEXT,
      goals TEXT,
      deliverables TEXT,
      raw_footage_available TEXT,
      reference_links TEXT,
      communication_preference TEXT,
      message TEXT,
      attachment_url TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      priority TEXT NOT NULL DEFAULT 'normal',
      source TEXT DEFAULT 'website',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      project_slug TEXT,
      path TEXT,
      metadata_json TEXT,
      ip_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS media_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      url TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      logo_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS client_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      access_token TEXT UNIQUE NOT NULL,
      expires_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS review_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_id INTEGER NOT NULL,
      timestamp_seconds REAL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(access_id) REFERENCES client_access(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS project_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      video_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMeNow!123';
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!user) {
    const hash = bcrypt.hashSync(adminPassword, 12);
    db.prepare('INSERT INTO users(email,password_hash,role) VALUES (?,?,?)').run(adminEmail, hash, 'owner');
  }

  const defaults = {
    name: 'Aditya Verma',
    alias: 'Levi',
    title: 'Video Editor · Motion Designer · Visual Storyteller',
    tagline: 'Turning raw footage into stories worth watching.',
    location: 'Lucknow, India — Available Worldwide',
    availability: 'Open to freelance projects',
    email: '',
    whatsapp: '',
    instagram: '_.iamlevi_',
    fiverr: '',
    showreel: '',
    bio: 'I edit short-form, cinematic and motion-led content with a focus on story, rhythm, sound and visual movement.',
    theme: 'dark'
  };
  const insert = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
  const tx = db.transaction(() => Object.entries(defaults).forEach(([k,v]) => insert.run(k, String(v))));
  tx();

  const serviceCount = db.prepare('SELECT COUNT(*) AS c FROM services').get().c;
  if (!serviceCount) {
    const services = [
      ['Short-form / Reels','Fast, story-driven vertical edits for Instagram and Shorts.','Premiere Pro, After Effects','["Edit from raw footage","Captions and text styling","Pacing and transitions","Platform-ready export"]',1],
      ['Cinematic Videos','Story-first edits with deliberate pacing, motion and sound.','Premiere Pro, After Effects','["Story structure","B-roll and pacing","Cinematic transitions","Final delivery"]',2],
      ['Motion Graphics','Animated titles, transitions and compositing that support the edit.','After Effects','["Kinetic type","Lower-thirds","Logo reveals","Custom motion elements"]',3],
      ['Event Videos','Highlights and recap edits built around the strongest moments.','Premiere Pro, After Effects','["Highlight edit","Music and SFX","Event storytelling","Social cutdowns"]',4],
      ['Sound Design','Sound choices that make cuts, transitions and moments land.','Premiere Pro, After Effects','["SFX layering","Music editing","Dialogue cleanup","Audio transitions"]',5],
      ['Social Media Content Editing','Consistent, platform-specific editing for creators and organizations.','Premiere Pro, Photoshop','["Content series","Captions","Multiple aspect ratios","Exports"]',6]
    ];
    const s = db.prepare('INSERT INTO services(title,description,tools,deliverables_json,sort_order) VALUES (?,?,?,?,?)');
    db.transaction(() => services.forEach(x => s.run(...x)))();
  }
  const pricingCount = db.prepare('SELECT COUNT(*) AS c FROM pricing').get().c;
  if (!pricingCount) {
    const packs = [
      ['Reels & Shorts Edit','One vertical video, cut and ready to post.','Custom quote','["Edit from raw footage","Captions and text styling","Trend-aware pacing","Instagram / Shorts export"]','2 revisions','Based on brief','["Fast turnaround available","Platform-ready delivery"]',0,1],
      ['YouTube Video Edit','One long-form video, structured from start to finish.','Custom quote','["Full edit","Cutaways and pacing","Titles and basic graphics","YouTube export"]','2 revisions','Based on brief','["Story-first structure","Clean finishing"]',1,2],
      ['Motion Graphics Add-on','Animated elements added to an edit you already have.','Custom quote','["Animated titles","Lower-thirds","Logo reveal","Custom transitions"]','2 revisions','Based on brief','["After Effects workflow","Project-aware motion"]',0,3],
      ['Full Project / Ongoing','Multiple videos or a recurring content workflow.','Custom quote','["Consistent style","Priority workflow","Direct collaboration"]','Flexible','Quoted per scope','["Recurring support","Content system"]',0,4]
    ];
    const p = db.prepare('INSERT INTO pricing(name,description,price,deliverables_json,revisions,turnaround,features_json,featured,sort_order) VALUES (?,?,?,?,?,?,?,?,?)');
    db.transaction(() => packs.forEach(x => p.run(...x)))();
  }
}

function settingsObject() {
  return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key,r.value]));
}

module.exports = { db, init, settingsObject };
