DROP DATABASE IF EXISTS relays;
CREATE DATABASE relays;
USE relays;

CREATE TABLE relay_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    team VARCHAR(100) NOT NULL,
    day VARCHAR(20) NOT NULL,
    edit_token VARCHAR(64) UNIQUE,      -- Added here
    submitted_at DATETIME NOT NULL
);

CREATE TABLE relay_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    event_id INT NOT NULL,
    line CHAR(1) NOT NULL,
    scratch TINYINT(1) DEFAULT 0,
    swim_prelim TINYINT(1) DEFAULT 0,
    swimmer1 VARCHAR(100),
    swimmer2 VARCHAR(100),
    swimmer3 VARCHAR(100),
    swimmer4 VARCHAR(100),
    mm TINYINT(1) DEFAULT 0,
    FOREIGN KEY (submission_id) REFERENCES relay_submissions(id) ON DELETE CASCADE
);

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    abbreviation VARCHAR(10)  -- Optional, e.g., 'BEST'
);

CREATE TABLE swimmers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    team VARCHAR(255) NOT NULL,
    lsc VARCHAR(255) NOT NULL,
    gender ENUM('F', 'M') NOT NULL,
    age TINYINT UNSIGNED NOT NULL,  -- Recommended: change to this
    -- If you need text ages, use: age VARCHAR(10) NOT NULL,
    INDEX idx_team_gender (team, gender)  -- Named composite index for faster queries
);

ALTER TABLE teams ADD COLUMN meet_slug VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE swimmers ADD COLUMN meet_slug VARCHAR(50) NOT NULL DEFAULT '';
ALTER TABLE relay_submissions ADD COLUMN meet_slug VARCHAR(50) NOT NULL DEFAULT '';
