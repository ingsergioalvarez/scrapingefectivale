-- Base de datos: la misma que uses en MYSQL_DATABASE (ej. ControlVehicular)
-- Las tablas también se crean solas al arrancar el servidor si MySQL está configurado.

CREATE TABLE IF NOT EXISTS efectivale_saldo_rows (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL,
  slot VARCHAR(10) NOT NULL COMMENT '05, 17 o boot',
  scraped_at DATETIME NOT NULL,
  efectivale_account_id INT NOT NULL,
  origen_label VARCHAR(255) NULL,
  cuenta VARCHAR(32) NOT NULL,
  tarjeta VARCHAR(32) NOT NULL,
  empleado VARCHAR(512) NULL,
  usuario_parametros VARCHAR(255) NULL,
  saldo DECIMAL(12,2) NULL,
  INDEX idx_cuenta_scraped (cuenta, scraped_at),
  INDEX idx_tarjeta_scraped (tarjeta(16), scraped_at),
  INDEX idx_batch (batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telegram_gasolina_requests (
  id VARCHAR(36) PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  telegram_user_id BIGINT NULL,
  solicitante_name VARCHAR(255) NULL,
  id_tipo ENUM('cuenta','tarjeta') NOT NULL,
  cuenta VARCHAR(32) NULL,
  tarjeta_ultimos7 VARCHAR(7) NULL,
  tipo_carga VARCHAR(32) NULL,
  actividad TEXT NULL,
  monto DECIMAL(12,2) NOT NULL,
  saldo_actual_scraped DECIMAL(12,2) NULL,
  max_saldo_regla DECIMAL(12,2) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS telegram_aclaraciones (
  id VARCHAR(36) PRIMARY KEY,
  telegram_chat_id BIGINT NOT NULL,
  telegram_user_id BIGINT NULL,
  solicitante_name VARCHAR(255) NULL,
  comentario TEXT NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
