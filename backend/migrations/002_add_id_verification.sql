-- Adds civilian ID-verification columns to the existing `users` table.
-- Safe to re-run: every statement uses IF NOT EXISTS.

ALTER TABLE users ADD COLUMN IF NOT EXISTS id_document_path        VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_path             VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_verification_status  VARCHAR NOT NULL DEFAULT 'unverified';
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_rejection_reason     VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_submitted_at         TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_reviewed_at          TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_reviewed_by          INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name               VARCHAR;
