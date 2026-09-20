-- Migration 002: Add password_salt column to users table for per-user salt storage
ALTER TABLE users ADD COLUMN password_salt TEXT;
