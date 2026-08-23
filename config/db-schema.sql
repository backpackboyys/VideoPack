-- Create Database
CREATE DATABASE IF NOT EXISTS video_platform_db;
USE video_platform_db;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  age_verified BOOLEAN DEFAULT FALSE,
  age_verified_date TIMESTAMP NULL,
  age_verification_provider VARCHAR(100) NULL,
  date_of_birth DATE NULL,
  profile_picture VARCHAR(255) NULL,
  bio TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

-- Age Verification Records
CREATE TABLE IF NOT EXISTS age_verifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  verification_method VARCHAR(100) NOT NULL,
  verification_id VARCHAR(255) UNIQUE,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATE NULL,
  status ENUM('pending', 'verified', 'failed', 'expired') DEFAULT 'pending',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500) NULL,
  duration INT NULL,
  file_size BIGINT,
  video_type ENUM('free', 'premium', 'pay-per-view') DEFAULT 'free',
  price DECIMAL(10, 2) NULL,
  view_count INT DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Video Views/Purchases Table
CREATE TABLE IF NOT EXISTS video_purchases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  video_id INT NOT NULL,
  purchase_type ENUM('view', 'subscription', 'ownership') DEFAULT 'view',
  price_paid DECIMAL(10, 2),
  transaction_id VARCHAR(255) UNIQUE,
  payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Payment Records
CREATE TABLE IF NOT EXISTS payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50),
  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(500) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Content Moderation Log
CREATE TABLE IF NOT EXISTS moderation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  video_id INT NOT NULL,
  action ENUM('submitted', 'approved', 'rejected', 'flagged', 'removed') DEFAULT 'submitted',
  moderator_notes TEXT,
  moderator_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create Indexes for better query performance
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_user_age_verified ON users(age_verified);
CREATE INDEX idx_video_user_id ON videos(user_id);
CREATE INDEX idx_video_is_public ON videos(is_public);
CREATE INDEX idx_video_is_approved ON videos(is_approved);
CREATE INDEX idx_purchase_user_video ON video_purchases(user_id, video_id);
CREATE INDEX idx_payment_user ON payments(user_id);
CREATE INDEX idx_session_token ON sessions(token);
