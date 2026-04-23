-- ARQUITECTURA OFICIAL - BASE DE DATOS
-- Este archivo contiene la estructura completa para soportar el módulo de autenticación (Simulador OAuth2)
-- Siguiendo Reglas 1-19 del proyecto.

CREATE DATABASE IF NOT EXISTS `ControlVehicular` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ControlVehicular`;

-- 1. Usuarios Centralizados
CREATE TABLE IF NOT EXISTS sys_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    empresa_id INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Roles del Sistema
CREATE TABLE IF NOT EXISTS sys_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- 3. Permisos Específicos
CREATE TABLE IF NOT EXISTS sys_permisos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL UNIQUE, -- Formato: MODULO_ACCION (Regla 8)
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB;

-- 4. Relación Usuarios -> Roles
CREATE TABLE IF NOT EXISTS sys_usuario_roles (
    usuario_id INT NOT NULL,
    rol_id INT NOT NULL,
    PRIMARY KEY (usuario_id, rol_id),
    FOREIGN KEY (usuario_id) REFERENCES sys_usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES sys_roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Relación Roles -> Permisos
CREATE TABLE IF NOT EXISTS sys_rol_permisos (
    rol_id INT NOT NULL,
    permiso_id INT NOT NULL,
    PRIMARY KEY (rol_id, permiso_id),
    FOREIGN KEY (rol_id) REFERENCES sys_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permiso_id) REFERENCES sys_permisos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- DATA BASE - USUARIO ADMIN POR DEFECTO
-- Inserción de permisos iniciales
INSERT IGNORE INTO sys_permisos (codigo, descripcion) VALUES 
('GASOLINA_VER', 'Ver paneles de gasolina'),
('GASOLINA_DISPERSAR', 'Realizar dispersiones de gasolina'),
('GASOLINA_CONFIG_REGLAS', 'Configurar reglas de recarga'),
('ADMIN_FULL_ACCESS', 'Acceso total al sistema');

-- Inserción de Rol Admin
INSERT IGNORE INTO sys_roles (nombre, descripcion) VALUES 
('ADMIN', 'Administrador Total del Sistema');

-- Asignación de todos los permisos al rol ADMIN
INSERT IGNORE INTO sys_rol_permisos (rol_id, permiso_id) 
SELECT 1, id FROM sys_permisos;

-- Usuario Inicial: admin@sistema.com / admin123 (Hash de prueba, se debe cambiar)
-- Hash para 'admin123' (ejemplo bcrypt)
INSERT IGNORE INTO sys_usuarios (nombre, email, password_hash) VALUES 
('Administrador', 'admin@sistema.com', '$2b$10$wOOp6oIDj5bZgU.38D4FxeP2m0Xj2Ym9L0v7D8.Xm6Yc08f1bM2W.');

-- Asignación de rol al usuario admin
INSERT IGNORE INTO sys_usuario_roles (usuario_id, rol_id) VALUES (1, 1);
