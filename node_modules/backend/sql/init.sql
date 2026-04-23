-- Referencia legacy (las cuentas viven en Excel: server/data/store.xlsx).
-- MySQL se usa para Telegram: cortes de saldo, solicitudes de gasolina, aclaraciones (ver server/sql/telegram_mysql.sql).

CREATE DATABASE IF NOT EXISTS `ConrolVehicular` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `ConrolVehicular`;

CREATE TABLE IF NOT EXISTS app_accounts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  app VARCHAR(32) NOT NULL,
  alias VARCHAR(100) NULL,
  username VARCHAR(191) NOT NULL,
  password_enc TEXT NOT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_app_accounts_app (app),
  UNIQUE KEY uniq_app_username (app, username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NOT NULL,
  storage_state_json MEDIUMTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_session_account (account_id),
  CONSTRAINT fk_sessions_account FOREIGN KEY (account_id) REFERENCES app_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
