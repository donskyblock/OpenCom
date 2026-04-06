CREATE TABLE IF NOT EXISTS oauth_links (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token VARCHAR(128) NOT NULL,
    app_id VARCHAR(128) NOT NULL,
    secret_code VARCHAR(128) NOT NULL,
    scopes JSON NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_oauth_links_token (token),
    KEY idx_oauth_links_app_id (app_id),
    KEY idx_oauth_links_secret_code (secret_code),
    CONSTRAINT chk_oauth_links_scopes_json CHECK (JSON_VALID(scopes))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
