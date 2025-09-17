-- Create the database (if not exists)
CREATE DATABASE pixelcanvas;

\c pixelcanvas;

-- Table to store pixels
CREATE TABLE IF NOT EXISTS pixels (
    x INT NOT NULL,
    y INT NOT NULL,
    color VARCHAR(7) NOT NULL,
    PRIMARY KEY (x, y)
);

-- Optional: table for user points (if you want to extend)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    points INT DEFAULT 10
);
