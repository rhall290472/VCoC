CREATE DATABASE email_generator;
USE email_generator;

CREATE TABLE teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_name VARCHAR(100) UNIQUE NOT NULL,
    emails JSON NOT NULL
);

INSERT INTO teams (team_name, emails) VALUES
('engineering', '["alice@example.com", "bob@example.com"]'),
('marketing', '["charlie@example.com", "diana@example.com"]'),
('sales', '["eve@example.com", "frank@example.com"]');