-- Im not even gonna lie I couldn't be assed to write a SQL schema so this is 100% ChatGPT generated with my params defined :) | It saved me abt 25 mins so give me a break

-- oauth_foundation.sql
-- MySQL 8+ / Amazon RDS compatible

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- OAUTH APPS
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_apps (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id BIGINT UNSIGNED NOT NULL, -- owner of the OAuth app

    app_id CHAR(36) NOT NULL,            -- public client/application ID
    app_name VARCHAR(150) NOT NULL,
    description TEXT NULL,

    client_secret_hash VARCHAR(255) NOT NULL, -- store hashed
    homepage_url VARCHAR(2048) NULL,
    redirect_uris JSON NOT NULL,

    is_active TINYINT(1) NOT NULL DEFAULT 1,
    is_confidential TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_apps_app_id (app_id),
    KEY idx_oauth_apps_account_id (account_id),

    CONSTRAINT fk_oauth_apps_account
        FOREIGN KEY (account_id) REFERENCES accounts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT chk_oauth_apps_redirect_uris_json CHECK (JSON_VALID(redirect_uris))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- MASTER SCOPE LIST
-- All scopes that can exist in your system
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_scopes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    scope VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_scopes_scope (scope),
    KEY idx_oauth_scopes_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- WHICH SCOPES AN APP IS ALLOWED TO REQUEST
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_app_scopes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    oauth_app_id BIGINT UNSIGNED NOT NULL,
    scope_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_app_scope (oauth_app_id, scope_id),
    KEY idx_oauth_app_scopes_scope_id (scope_id),

    CONSTRAINT fk_oauth_app_scopes_app
        FOREIGN KEY (oauth_app_id) REFERENCES oauth_apps(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oauth_app_scopes_scope
        FOREIGN KEY (scope_id) REFERENCES oauth_scopes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- ISSUED TOKENS
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    oauth_app_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL, -- user/account that authorized the token

    access_token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255) NULL,

    token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    jti CHAR(36) NULL,

    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    access_expires_at TIMESTAMP NULL,
    refresh_expires_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,

    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1024) NULL,
    last_used_at TIMESTAMP NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_tokens_access_token_hash (access_token_hash),
    UNIQUE KEY uq_oauth_tokens_refresh_token_hash (refresh_token_hash),
    UNIQUE KEY uq_oauth_tokens_jti (jti),

    KEY idx_oauth_tokens_oauth_app_id (oauth_app_id),
    KEY idx_oauth_tokens_account_id (account_id),
    KEY idx_oauth_tokens_is_active (is_active),
    KEY idx_oauth_tokens_access_expires_at (access_expires_at),
    KEY idx_oauth_tokens_refresh_expires_at (refresh_expires_at),

    CONSTRAINT fk_oauth_tokens_oauth_app
        FOREIGN KEY (oauth_app_id) REFERENCES oauth_apps(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oauth_tokens_account
        FOREIGN KEY (account_id) REFERENCES accounts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- SCOPES ACTUALLY GRANTED TO A TOKEN
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_token_scopes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    oauth_token_id BIGINT UNSIGNED NOT NULL,
    scope_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_token_scope (oauth_token_id, scope_id),
    KEY idx_oauth_token_scopes_scope_id (scope_id),

    CONSTRAINT fk_oauth_token_scopes_token
        FOREIGN KEY (oauth_token_id) REFERENCES oauth_tokens(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oauth_token_scopes_scope
        FOREIGN KEY (scope_id) REFERENCES oauth_scopes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- OPTIONAL: AUTHORIZATION CODES
-- Useful if you're doing full OAuth authorization code flow
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    oauth_app_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,

    authorization_code_hash VARCHAR(255) NOT NULL,
    code_challenge VARCHAR(255) NULL,
    code_challenge_method VARCHAR(20) NULL,

    redirect_uri VARCHAR(2048) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed_at TIMESTAMP NULL,

    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(1024) NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_authorization_codes_hash (authorization_code_hash),
    KEY idx_oauth_authorization_codes_oauth_app_id (oauth_app_id),
    KEY idx_oauth_authorization_codes_account_id (account_id),
    KEY idx_oauth_authorization_codes_expires_at (expires_at),

    CONSTRAINT fk_oauth_authorization_codes_app
        FOREIGN KEY (oauth_app_id) REFERENCES oauth_apps(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oauth_authorization_codes_account
        FOREIGN KEY (account_id) REFERENCES accounts(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- SCOPES ON AUTHORIZATION CODES
-- =========================================================
CREATE TABLE IF NOT EXISTS oauth_authorization_code_scopes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    authorization_code_id BIGINT UNSIGNED NOT NULL,
    scope_id BIGINT UNSIGNED NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_authorization_code_scope (authorization_code_id, scope_id),

    CONSTRAINT fk_oauth_authorization_code_scopes_code
        FOREIGN KEY (authorization_code_id) REFERENCES oauth_authorization_codes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_oauth_authorization_code_scopes_scope
        FOREIGN KEY (scope_id) REFERENCES oauth_scopes(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =========================================================
-- SEED BASIC SCOPES
-- Discord-like app basics:
-- identity, account details, email, servers/guilds, subscriptions
-- =========================================================
INSERT INTO oauth_scopes (scope, description) VALUES
    ('read:account', 'Read basic account profile details'),
    ('update:account', 'Update basic account profile details'),
    ('read:email', 'Read the account email address'),
    ('update:email', 'Update the account email address'),
    ('read:servers', 'Read servers/guilds the account belongs to'),
    ('read:server_memberships', 'Read membership information for joined servers'),
    ('read:subscription', 'Read account subscription or premium status'),
    ('read:billing', 'Read billing summary information'),
    ('read:connections', 'Read linked external account connections'),
    ('update:connections', 'Manage linked external account connections'),
    ('read:avatar', 'Read avatar and profile media information'),
    ('update:avatar', 'Update avatar and profile media information'),
    ('read:preferences', 'Read user preferences and settings'),
    ('update:preferences', 'Update user preferences and settings'),
    ('read:sessions', 'Read active login or session information'),
    ('revoke:sessions', 'Revoke active login or session information'),
    ('read:applications', 'Read applications owned by the account'),
    ('update:applications', 'Update applications owned by the account')
ON DUPLICATE KEY UPDATE
    description = VALUES(description),
    is_active = 1;

SET FOREIGN_KEY_CHECKS = 1;