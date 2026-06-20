-- Fritzie Dashboard Database Schema
-- Auto-runs on first Docker startup

CREATE DATABASE IF NOT EXISTS fritzie_dashboard;
USE fritzie_dashboard;

-- Locations/Clients table
CREATE TABLE IF NOT EXISTS locations (
  id            VARCHAR(191)  PRIMARY KEY DEFAULT (UUID()),
  name          VARCHAR(255) NOT NULL,
  gbp_id        VARCHAR(255) UNIQUE,
  address       VARCHAR(500),
  phone         VARCHAR(50),
  website       VARCHAR(500),
  campaign      VARCHAR(255),
  status        ENUM('active', 'inactive', 'needs_attention') DEFAULT 'active',
  gbp_connected BOOLEAN   DEFAULT FALSE,
  gbp_rating    DOUBLE NULL,
  gbp_review_count INT DEFAULT 0,
  last_synced   TIMESTAMP NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id          VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  name        VARCHAR(255) NOT NULL,
  status      ENUM('active', 'ended', 'draft') DEFAULT 'active',
  emails_sent INT DEFAULT 0,
  open_rate   DECIMAL(5,2) DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Reviews table (all GBP reviews)
CREATE TABLE IF NOT EXISTS reviews (
  id           VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  location_id  VARCHAR(191),
  reviewer     VARCHAR(255),
  stars        TINYINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  review_text  TEXT,
  sentiment    ENUM('positive', 'neutral', 'negative') DEFAULT 'neutral',
  replied      BOOLEAN DEFAULT FALSE,
  reply_text   TEXT,
  campaign     VARCHAR(255),
  review_date  TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id          VARCHAR(191)  PRIMARY KEY DEFAULT (UUID()),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  status      ENUM('backlog', 'in_progress', 'in_review', 'done') DEFAULT 'backlog',
  client_id   VARCHAR(191),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES locations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS task_checklists (
  id         VARCHAR(191)  PRIMARY KEY DEFAULT (UUID()),
  task_id    VARCHAR(191)  NOT NULL,
  text       VARCHAR(500) NOT NULL,
  completed  BOOLEAN      DEFAULT FALSE,
  sort_order INT          DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS task_files (
  id         VARCHAR(191)    PRIMARY KEY DEFAULT (UUID()),
  task_id    VARCHAR(191)    NOT NULL,
  file_name  VARCHAR(255)   NOT NULL,
  file_url   VARCHAR(1000)  NOT NULL,
  file_size  INT,
  mime_type  VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Patient lists connected to Google Sheets
CREATE TABLE IF NOT EXISTS patient_lists (
  id                 VARCHAR(191)   PRIMARY KEY DEFAULT (UUID()),
  location_id        VARCHAR(191)   NOT NULL UNIQUE,
  sheet_link         VARCHAR(1000) NOT NULL,
  name_column        VARCHAR(255) NULL,
  email_column       VARCHAR(255) NULL,
  last_imported_at   TIMESTAMP NULL,
  last_fetched_at    TIMESTAMP NULL,
  last_campaign_ran  TIMESTAMP NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patients (
  id              VARCHAR(191)  PRIMARY KEY DEFAULT (UUID()),
  patient_list_id VARCHAR(191)  NOT NULL,
  name            VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  is_new          BOOLEAN      DEFAULT TRUE,
  imported_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY patients_patient_list_email_unique (patient_list_id, email),
  FOREIGN KEY (patient_list_id) REFERENCES patient_lists(id) ON DELETE CASCADE
);

-- Auth and settings
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(191) NOT NULL UNIQUE,
  name          VARCHAR(191) NOT NULL,
  password_hash VARCHAR(500) NOT NULL,
  role          ENUM('super_admin', 'admin', 'member') DEFAULT 'member',
  status        ENUM('active', 'disabled') DEFAULT 'active',
  last_login_at DATETIME(3) NULL,
  created_at    DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS invites (
  id            VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(191) NOT NULL,
  role          ENUM('super_admin', 'admin', 'member') DEFAULT 'member',
  token_hash    VARCHAR(500) NOT NULL UNIQUE,
  status        ENUM('pending', 'accepted', 'revoked') DEFAULT 'pending',
  expires_at    DATETIME(3) NOT NULL,
  accepted_at   DATETIME(3) NULL,
  created_at    DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  invited_by_id VARCHAR(191) NULL,
  FOREIGN KEY (invited_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  `key`      VARCHAR(191) PRIMARY KEY,
  value      TEXT NOT NULL,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS daily_summary_logs (
  id           VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  status       ENUM('success', 'failed') NOT NULL,
  message      TEXT,
  payload      TEXT,
  delivered_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS email_otps (
  id          VARCHAR(191) PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(191) NOT NULL,
  email       VARCHAR(191) NOT NULL,
  code_hash   VARCHAR(500) NOT NULL,
  purpose     ENUM('email_change') DEFAULT 'email_change',
  expires_at  DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at  DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  KEY email_otps_user_id_email_purpose_idx (user_id, email, purpose)
);

-- ─── If upgrading an existing DB, run these ALTER statements manually ──────────
-- ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone         VARCHAR(50)  AFTER address;
-- ALTER TABLE locations ADD COLUMN IF NOT EXISTS website       VARCHAR(500) AFTER phone;
-- ALTER TABLE locations ADD COLUMN IF NOT EXISTS gbp_connected BOOLEAN      DEFAULT FALSE AFTER status;
-- ALTER TABLE locations ADD COLUMN IF NOT EXISTS last_synced   TIMESTAMP    NULL AFTER gbp_connected;
-- ALTER TABLE locations MODIFY COLUMN gbp_id VARCHAR(255) UNIQUE;
-- Also create patient_lists and patients tables above for existing databases.
-- ──────────────────────────────────────────────────────────────────────────────

-- Seed: sample locations
INSERT INTO locations (id, name, gbp_id, address, campaign, status, gbp_connected) VALUES
  (UUID(), 'Dubai Marina Branch',  'gbp_001', 'Dubai Marina, Dubai, UAE',        'Summer Promo', 'active',           TRUE),
  (UUID(), 'JBR Branch',           'gbp_002', 'Jumeirah Beach Residence, Dubai',  'Summer Promo', 'active',           TRUE),
  (UUID(), 'Deira City Centre',    'gbp_003', 'Deira, Dubai, UAE',                'June Blast',   'needs_attention',  FALSE),
  (UUID(), 'Downtown Dubai',       'gbp_004', 'Downtown Dubai, UAE',              'Summer Promo', 'active',           TRUE),
  (UUID(), 'Business Bay',         'gbp_005', 'Business Bay, Dubai, UAE',         'Ramadan',      'needs_attention',  FALSE),
  (UUID(), 'DIFC Branch',          'gbp_006', 'DIFC, Dubai, UAE',                 'June Blast',   'active',           TRUE),
  (UUID(), 'Al Barsha Branch',     'gbp_007', 'Al Barsha, Dubai, UAE',            'Ramadan',      'needs_attention',  FALSE);

-- Seed: default super admin
INSERT INTO users (email, name, password_hash, role, status) VALUES
  ('admin@example.com', 'Super Admin', 'pbkdf2_sha256$310000$5a20dbe248ac3d089f019758925f8c59$d13887317891ae494895a50e90c6f83c30aace90669b0e91427ed8f60874c6f3', 'super_admin', 'active')
ON DUPLICATE KEY UPDATE role = 'super_admin', status = 'active';

-- Seed: sample campaigns
INSERT INTO campaigns (id, name, status, emails_sent, open_rate) VALUES
  (UUID(), 'Summer Promo', 'active', 12400, 38.0),
  (UUID(), 'June Blast',   'active',  8750, 31.0),
  (UUID(), 'Ramadan',      'ended',  15200, 44.0);

-- Seed: sample reviews (linked by gbp_id lookup)
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Ahmed K.',   5, 'Absolutely amazing service, will come back!',      'positive', TRUE,  'Summer Promo', NOW() - INTERVAL 2  HOUR  FROM locations l WHERE l.gbp_id = 'gbp_001';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Sara M.',    1, 'Service was very disappointing, no one helped.',   'negative', FALSE, 'June Blast',   NOW() - INTERVAL 2  DAY   FROM locations l WHERE l.gbp_id = 'gbp_003';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Rami T.',    5, 'Great experience from start to finish!',           'positive', TRUE,  'Summer Promo', NOW() - INTERVAL 4  HOUR  FROM locations l WHERE l.gbp_id = 'gbp_002';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Lina F.',    2, 'Waited too long, staff not very helpful.',         'negative', FALSE, 'Ramadan',      NOW() - INTERVAL 3  DAY   FROM locations l WHERE l.gbp_id = 'gbp_007';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Omar J.',    4, 'Great but parking is always an issue here.',       'neutral',  FALSE, 'June Blast',   NOW() - INTERVAL 5  HOUR  FROM locations l WHERE l.gbp_id = 'gbp_006';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Nora A.',    5, 'Loved everything about this experience!',          'positive', TRUE,  'Summer Promo', NOW() - INTERVAL 1  DAY   FROM locations l WHERE l.gbp_id = 'gbp_004';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Khalid R.',  3, 'Average experience, nothing special.',             'neutral',  FALSE, 'Ramadan',      NOW() - INTERVAL 6  HOUR  FROM locations l WHERE l.gbp_id = 'gbp_005';
INSERT INTO reviews (id, location_id, reviewer, stars, review_text, sentiment, replied, campaign, review_date)
SELECT UUID(), l.id, 'Maya S.',    5, 'Staff were so friendly and helpful!',              'positive', FALSE, 'June Blast',   NOW() - INTERVAL 1  HOUR  FROM locations l WHERE l.gbp_id = 'gbp_002';
