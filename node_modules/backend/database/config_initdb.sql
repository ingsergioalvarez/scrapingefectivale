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

-- 6. Grupos Logísticos (Segmentación de Flota)
CREATE TABLE IF NOT EXISTS cv_grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 8. Auditoría de Consultas Sensibles (NIPs)
CREATE TABLE IF NOT EXISTS sys_auditoria_nips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    cuenta VARCHAR(50) NOT NULL,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    FOREIGN KEY (usuario_id) REFERENCES sys_usuarios(id)
) ENGINE=InnoDB;

-- 7. Relación Usuarios -> Grupos (Para limitar visibilidad)
CREATE TABLE IF NOT EXISTS cv_usuario_grupos (
    usuario_id INT NOT NULL,
    grupo_id INT NOT NULL,
    PRIMARY KEY (usuario_id, grupo_id),
    FOREIGN KEY (usuario_id) REFERENCES sys_usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES cv_grupos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- DATA BASE - USUARIO ADMIN POR DEFECTO
-- Inserción de permisos iniciales expandidos
INSERT IGNORE INTO sys_permisos (codigo, descripcion) VALUES 
('IDENTITY_GESTION', 'Gestionar usuarios, roles y accesos'),
('GASOLINA_VER', 'Ver paneles de gasolina'),
('GASOLINA_DISPERSAR', 'Realizar dispersiones de gasolina'),
('GASOLINA_CONFIG_REGLAS', 'Configurar reglas de recarga'),

('CHOFERES_VER', 'Ver catálogo de choferes'),
('CHOFERES_CREAR', 'Dar de alta nuevos choferes'),
('CHOFERES_EDITAR', 'Modificar datos de choferes'),
('CHOFERES_ELIMINAR', 'Dar de baja choferes'),

('VEHICULOS_VER', 'Ver catálogo de vehículos'),
('VEHICULOS_CREAR', 'Dar de alta nuevos vehículos'),
('VEHICULOS_EDITAR', 'Modificar datos de vehículos'),
('VEHICULOS_ELIMINAR', 'Dar de baja vehículos'),

('MOVIMIENTOS_VER', 'Ver historial de movimientos'),
('CV_REASIGNAR', 'Reasignar activos (tarjetas/autos) a choferes'),
('ADMIN_FULL_ACCESS', 'Acceso total al sistema');

-- Inserción de un grupo inicial
INSERT IGNORE INTO cv_grupos (nombre, descripcion) VALUES ('GENERAL', 'Grupo logístico por defecto');

-- Inserción de Rol Admin
INSERT IGNORE INTO sys_roles (nombre, descripcion) VALUES 
('ADMIN', 'Administrador Total del Sistema'),
('LOGISTICA', 'Monitor Logístico - Solo Operación');

-- Asignación de permisos a Admin (ADMIN_FULL_ACCESS)
INSERT IGNORE INTO sys_rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id 
FROM sys_roles r, sys_permisos p 
WHERE r.nombre = 'ADMIN' AND p.codigo = 'ADMIN_FULL_ACCESS';

-- Asignación de permisos a Logística (Monitor Logístico)
INSERT IGNORE INTO sys_rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id 
FROM sys_roles r, sys_permisos p 
WHERE r.nombre = 'LOGISTICA' AND p.codigo IN (
    'CHOFERES_VER', 
    'CHOFERES_CREAR', 
    'VEHICULOS_VER', 
    'VEHICULOS_CREAR', 
    'GASOLINA_VER',
    'CV_REASIGNAR'
);

-- Usuario Inicial: admin@sistema.com / admin123
INSERT IGNORE INTO sys_usuarios (nombre, email, password_hash) VALUES 
('Administrador', 'admin@sistema.com', '$2b$10$a.A5zLFb.34AkyOFQDiFsuIlYWvjtWMirOyASht4mZzmbkxURonfy');

-- En caso de que ya exista pero el hash fuera incorrecto
UPDATE sys_usuarios SET password_hash = '$2b$10$a.A5zLFb.34AkyOFQDiFsuIlYWvjtWMirOyASht4mZzmbkxURonfy' WHERE email = 'admin@sistema.com';

-- Asignación de rol al usuario admin
INSERT IGNORE INTO sys_usuario_roles (usuario_id, rol_id) VALUES (1, 1);
