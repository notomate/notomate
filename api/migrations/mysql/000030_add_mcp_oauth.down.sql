DROP TABLE IF EXISTS oauth_grants;
DROP TABLE IF EXISTS oauth_codes;
DROP TABLE IF EXISTS oauth_clients;
DROP INDEX idx_api_keys_grant_id ON api_keys;
ALTER TABLE api_keys DROP COLUMN grant_id;
ALTER TABLE api_keys DROP COLUMN scope;
