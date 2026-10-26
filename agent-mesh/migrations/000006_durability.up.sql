-- 000006_durability.up.sql
-- Additive columns so the durable credential store round-trips every field on
-- identity.Credential without data loss (last_used_at / description were not in the base schema).
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS description TEXT;
