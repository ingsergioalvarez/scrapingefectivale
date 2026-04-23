import { pool } from '../db'
import { randomUUID } from 'node:crypto'

export type SaldoSlot = '05' | '17' | 'boot'

export function mysqlEnabled(): boolean {
  return !!(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE)
}

export async function ensureMysqlTables(): Promise<void> {
  console.log('[mysql] Verificando tablas...');
  // 1. Cuentas (Accesos)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS efectivale_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      app VARCHAR(32) NOT NULL,
      alias VARCHAR(255) NULL,
      username VARCHAR(255) NOT NULL,
      password_enc TEXT NOT NULL,
      extra_json TEXT NULL,
      wallet_balance DECIMAL(15,2) DEFAULT 0,
      last_wallet_sync DATETIME NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_app_user (app, username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  console.log('[mysql] Tabla efectivale_accounts lista');

  try {
    await pool.query(`ALTER TABLE efectivale_accounts ADD COLUMN wallet_balance DECIMAL(15,2) DEFAULT 0 AFTER extra_json;`)
    await pool.query(`ALTER TABLE efectivale_accounts ADD COLUMN last_wallet_sync DATETIME NULL AFTER wallet_balance;`)
  } catch (e) {}

  // 2. Sesiones
  await pool.query(`
    CREATE TABLE IF NOT EXISTS efectivale_sessions (
      account_id INT PRIMARY KEY,
      storage_state_json LONGTEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 3. Saldos (Un registro único por cuenta)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS efectivale_saldo_rows (
      cuenta VARCHAR(32) PRIMARY KEY,
      tarjeta VARCHAR(32) NOT NULL,
      empleado VARCHAR(512) NULL,
      usuario_parametros VARCHAR(255) NULL,
      saldo DECIMAL(12,2) NULL,
      scraped_at DATETIME NOT NULL,
      slot VARCHAR(10) NOT NULL COMMENT '05, 17 o boot',
      efectivale_account_id INT NOT NULL,
      origen_label VARCHAR(255) NULL,
      INDEX idx_tarjeta (tarjeta(16))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 4. Solicitudes Gasolina
  await pool.query(`
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
      admin_approver_id BIGINT NULL,
      admin_approver_name VARCHAR(255) NULL,
      error_message TEXT NULL,
      chofer_id INT NULL,
      vehiculo_id INT NULL,
      tarjeta VARCHAR(32) NULL,
      codigo_card VARCHAR(32) NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_status (status),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  try {
     await pool.query(`ALTER TABLE telegram_gasolina_requests ADD COLUMN chofer_id INT NULL AFTER error_message;`)
     await pool.query(`ALTER TABLE telegram_gasolina_requests ADD COLUMN vehiculo_id INT NULL AFTER chofer_id;`)
     await pool.query(`ALTER TABLE telegram_gasolina_requests ADD COLUMN tarjeta VARCHAR(32) NULL AFTER vehiculo_id;`)
     await pool.query(`ALTER TABLE telegram_gasolina_requests ADD COLUMN codigo_card VARCHAR(32) NULL AFTER tarjeta;`)
  } catch (e) {}

  // 5. Aclaraciones
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_aclaraciones (
      id VARCHAR(36) PRIMARY KEY,
      telegram_chat_id BIGINT NOT NULL,
      telegram_user_id BIGINT NULL,
      solicitante_name VARCHAR(255) NULL,
      comentario TEXT NOT NULL,
      created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 6. Reglas de Recarga
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_topup_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      efectivale_account_id INT NOT NULL,
      cuenta VARCHAR(32) NOT NULL,
      alias VARCHAR(255) NULL,
      short_code INT NULL,
      chofer_id INT NULL,
      vehiculo_id INT NULL,
      min_saldo DECIMAL(12,2) DEFAULT 0,
      max_saldo DECIMAL(12,2) DEFAULT 0,
      frecuencia VARCHAR(32) DEFAULT 'A LIBRE DEMANDA',
      modo_carga VARCHAR(32) DEFAULT 'COMPLETAR',
      enabled BOOLEAN DEFAULT TRUE,
      inactive_reason TEXT NULL,
      notes TEXT NULL,
      nip VARCHAR(10) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_cuenta (cuenta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Asegurar que las columnas existen
  try {
    await pool.query(`ALTER TABLE telegram_topup_rules ADD COLUMN modo_carga VARCHAR(32) DEFAULT 'COMPLETAR' AFTER frecuencia;`)
  } catch (err) {}
  try {
    await pool.query(`ALTER TABLE telegram_topup_rules ADD COLUMN nip VARCHAR(10) NULL AFTER notes;`)
  } catch (err) {}

  // 12. Auditoría NIPs
  console.log('[mysql] Verificando sys_auditoria_nips...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sys_auditoria_nips (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      cuenta VARCHAR(50) NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)
  console.log('[mysql] Tabla sys_auditoria_nips lista');

  // 7. Sesiones de Bot de Telegram
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_bot_sessions (
      chat_id BIGINT PRIMARY KEY,
      step_json TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 8. Grupos Logísticos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_grupos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL UNIQUE,
      descripcion TEXT,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Relación Usuarios -> Grupos (Para limitar visibilidad)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_usuario_grupos (
      usuario_id INT NOT NULL,
      grupo_id INT NOT NULL,
      PRIMARY KEY (usuario_id, grupo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 9. Choferes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_choferes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      grupo_id INT NULL,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_chofer_grupo FOREIGN KEY (grupo_id) REFERENCES cv_grupos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  try {
    await pool.query(`ALTER TABLE cv_choferes ADD COLUMN grupo_id INT NULL AFTER nombre;`)
  } catch (e) {}

  // 10. Vehículos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_vehiculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      placas VARCHAR(20) NOT NULL UNIQUE,
      modelo VARCHAR(100) NULL,
      anio INT NULL,
      grupo_id INT NULL,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_vehiculo_grupo FOREIGN KEY (grupo_id) REFERENCES cv_grupos(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  try {
    await pool.query(`ALTER TABLE cv_vehiculos ADD COLUMN grupo_id INT NULL AFTER anio;`)
  } catch (e) {}

  // 10. Historial de Asignaciones
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_historial_asignaciones (
      id INT AUTO_INCREMENT PRIMARY KEY,
      chofer_id INT NOT NULL,
      tipo ENUM('VEHICULO', 'GASOLINA') NOT NULL,
      referencia VARCHAR(100) NOT NULL, -- ID de vehiculo o Cuenta de gasolina
      detalles VARCHAR(255) NULL,      -- Placas o Alias
      fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_fin DATETIME NULL,
      activo BOOLEAN DEFAULT TRUE,
      INDEX idx_chofer (chofer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  try {
    await pool.query('ALTER TABLE telegram_gasolina_requests ADD COLUMN saldo_actual_scraped DECIMAL(12,2) NULL AFTER actividad')
  } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE telegram_gasolina_requests ADD COLUMN max_saldo_regla DECIMAL(12,2) NULL AFTER saldo_actual_scraped')
  } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE telegram_gasolina_requests ADD COLUMN admin_approver_id BIGINT NULL')
  } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE telegram_gasolina_requests ADD COLUMN admin_approver_name VARCHAR(255) NULL')
  } catch { /* ignore */ }

  // Nuevas columnas para reglas
  try {
    await pool.query('ALTER TABLE telegram_topup_rules ADD COLUMN short_code INT NULL AFTER alias')
  } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE telegram_topup_rules ADD COLUMN chofer_id INT NULL AFTER short_code')
  } catch { /* ignore */ }
  try {
    await pool.query('ALTER TABLE telegram_topup_rules ADD COLUMN vehiculo_id INT NULL AFTER chofer_id')
  } catch { /* ignore */ }
}

// --- CUENTAS (ACCOUNTS) ---

export type AccountRow = {
  id: number
  app: string
  alias: string | null
  username: string
  password_enc: string
  extra_json: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

export async function listAccountsMySql(): Promise<(AccountRow & { hasSession: boolean })[]> {
  const [rows] = await pool.query<any[]>(`
    SELECT a.*, (s.account_id IS NOT NULL) AS hasSession
    FROM efectivale_accounts a
    LEFT JOIN efectivale_sessions s ON a.id = s.account_id
    ORDER BY a.id DESC
  `)
  return rows.map(r => ({ ...r, hasSession: !!r.hasSession }))
}

export async function getAccountMySql(id: number): Promise<AccountRow | null> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM efectivale_accounts WHERE id = ?`, [id])
  return rows[0] || null
}

export async function createAccountMySql(input: Omit<AccountRow, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const [result]: any = await pool.execute(
    `INSERT INTO efectivale_accounts (app, alias, username, password_enc, extra_json, notes) VALUES (?,?,?,?,?,?)`,
    [input.app, input.alias, input.username, input.password_enc, input.extra_json, input.notes]
  )
  return result.insertId
}

export async function updateAccountMySql(id: number, patch: Partial<AccountRow>): Promise<boolean> {
  const fields: string[] = []
  const values: any[] = []
  
  if (patch.alias !== undefined) { fields.push('alias = ?'); values.push(patch.alias); }
  if (patch.username !== undefined) { fields.push('username = ?'); values.push(patch.username); }
  if (patch.password_enc !== undefined) { fields.push('password_enc = ?'); values.push(patch.password_enc); }
  if (patch.extra_json !== undefined) { fields.push('extra_json = ?'); values.push(patch.extra_json); }
  if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes); }

  if (fields.length === 0) return true
  values.push(id)
  const [result]: any = await pool.execute(
    `UPDATE efectivale_accounts SET ${fields.join(', ')} WHERE id = ?`,
    values
  )
  return result.affectedRows > 0
}

export async function deleteAccountMySql(id: number): Promise<void> {
  await pool.execute(`DELETE FROM efectivale_accounts WHERE id = ?`, [id])
  await pool.execute(`DELETE FROM efectivale_sessions WHERE account_id = ?`, [id])
}

// --- SESIONES (SESSIONS) ---

export type SessionRow = {
  account_id: number
  storage_state_json: string
  updated_at: Date
}

export async function getSessionMySql(accountId: number): Promise<SessionRow | null> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM efectivale_sessions WHERE account_id = ?`, [accountId])
  return rows[0] || null
}

export async function upsertSessionMySql(accountId: number, storageStateJson: string): Promise<void> {
  await pool.execute(
    `INSERT INTO efectivale_sessions (account_id, storage_state_json) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE storage_state_json = VALUES(storage_state_json), updated_at = CURRENT_TIMESTAMP`,
    [accountId, storageStateJson]
  )
}

// --- SALDOS (SNAPSHOTS) ---

export async function upsertSaldoRows(
  slot: SaldoSlot,
  scrapedAt: Date,
  rows: Array<{
    efectivaleAccountId: number
    origenLabel: string
    cuenta: string
    tarjeta: string
    empleado: string
    usuarioParametros: string
    saldo: number | null
  }>
): Promise<void> {
  if (!rows.length) return
  const sql = `INSERT INTO efectivale_saldo_rows
    (cuenta, tarjeta, empleado, usuario_parametros, saldo, scraped_at, slot, efectivale_account_id, origen_label)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      tarjeta = VALUES(tarjeta),
      empleado = VALUES(empleado),
      usuario_parametros = VALUES(usuario_parametros),
      saldo = VALUES(saldo),
      scraped_at = VALUES(scraped_at),
      slot = VALUES(slot),
      origen_label = VALUES(origen_label)`
  
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const r of rows) {
      await conn.execute(sql, [
        r.cuenta,
        r.tarjeta,
        r.empleado || null,
        r.usuarioParametros || null,
        r.saldo ?? null,
        scrapedAt,
        slot,
        r.efectivaleAccountId,
        r.origenLabel || null
      ])
    }
    await conn.commit()
  } catch (e) {
    await conn.rollback()
    throw e
  } finally {
    conn.release()
  }
}

/**
 * Actualiza el saldo de una cuenta específica (ej: después de una dispersión).
 */
export async function updateSingleSaldo(cuenta: string, nuevoSaldo: number): Promise<boolean> {
  const [result]: any = await pool.execute(
    `UPDATE efectivale_saldo_rows SET saldo = ?, scraped_at = CURRENT_TIMESTAMP WHERE cuenta = ?`,
    [nuevoSaldo, cuenta]
  )
  return result.affectedRows > 0
}

export async function getLatestSaldoByCuenta(cuenta: string) {
  const [rows] = await pool.query<any[]>(
    `SELECT saldo, scraped_at, slot, origen_label, tarjeta
     FROM efectivale_saldo_rows WHERE cuenta = ?`,
    [cuenta.trim()]
  )
  const r = rows[0]
  if (!r) return null
  return {
    saldo: r.saldo != null ? Number(r.saldo) : null,
    scrapedAt: new Date(r.scraped_at),
    slot: String(r.slot),
    origenLabel: r.origen_label,
    tarjeta: String(r.tarjeta ?? ''),
  }
}

export async function getLatestSaldoByTarjetaUltimos7(ultimos7: string) {
  const u = String(ultimos7).replace(/\D/g, '').slice(-7)
  if (u.length !== 7) return null
  const [rows] = await pool.query<any[]>(
    `SELECT cuenta, saldo, scraped_at, slot, origen_label, tarjeta
     FROM efectivale_saldo_rows WHERE RIGHT(REPLACE(tarjeta, ' ', ''), 7) = ?`,
    [u]
  )
  const r = rows[0]
  if (!r) return null
  return {
    cuenta: String(r.cuenta),
    saldo: r.saldo != null ? Number(r.saldo) : null,
    scrapedAt: new Date(r.scraped_at),
    slot: String(r.slot),
    origenLabel: r.origen_label,
    tarjeta: String(r.tarjeta ?? ''),
  }
}

// --- SOLICITUDES GASOLINA ---

export type GasolinaRequestRow = {
  id: string
  telegram_chat_id: number
  telegram_user_id: number | null
  solicitante_name: string | null
  id_tipo: 'cuenta' | 'tarjeta'
  cuenta: string | null
  tarjeta_ultimos7: string | null
  tipo_carga: string | null
  actividad: string | null
  monto: number
  saldo_actual_scraped: number | null
  max_saldo_regla: number | null
  status: string
  admin_note: string | null
  admin_approver_id: number | null
  admin_approver_name: string | null
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export async function createGasolinaRequest(input: Partial<GasolinaRequestRow>): Promise<string> {
  const id = input.id ?? randomUUID()
  const now = new Date()
  
  const sql = `
    INSERT INTO telegram_gasolina_requests 
    (id, telegram_chat_id, telegram_user_id, solicitante_name, id_tipo, cuenta, tarjeta_ultimos7, tipo_carga, actividad, monto, saldo_actual_scraped, max_saldo_regla, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  
  const values = [
    id, 
    input.telegram_chat_id, 
    input.telegram_user_id ?? null, 
    input.solicitante_name ?? null, 
    input.id_tipo,
    input.cuenta ?? null, 
    input.tarjeta_ultimos7 ?? null, 
    input.tipo_carga ?? null, 
    input.actividad ?? null, 
    input.monto ?? 0,
    input.saldo_actual_scraped ?? null, 
    input.max_saldo_regla ?? null, 
    input.status || 'pending', 
    now, 
    now
  ]

  await pool.query(sql, values)
  return id
}

export async function listGasolinaRequests(status?: string): Promise<any[]> {
  let query = `
    SELECT 
      r.*, 
      c.nombre as chofer_nombre, 
      v.placas as vehiculo_placas,
      v.modelo as vehiculo_modelo
    FROM telegram_gasolina_requests r 
    LEFT JOIN cv_choferes c ON r.chofer_id = c.id
    LEFT JOIN cv_vehiculos v ON r.vehiculo_id = v.id
  `
  let params: any[] = []
  if (status) {
    query += ` WHERE r.status = ?`
    params.push(status)
  }
  query += ` ORDER BY r.created_at DESC LIMIT 200`
  
  const [rows] = await pool.query<any[]>(query, params)
  return rows.map(r => ({
    ...r,
    telegram_chat_id: Number(r.telegram_chat_id),
    monto: Number(r.monto),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at)
  }))
}

export async function getGasolinaRequest(id: string): Promise<GasolinaRequestRow | null> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM telegram_gasolina_requests WHERE id = ?`, [id])
  if (!rows[0]) return null
  const r = rows[0]
  return {
    ...r,
    telegram_chat_id: Number(r.telegram_chat_id),
    monto: Number(r.monto),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at)
  }
}

export async function updateGasolinaRequest(id: string, patch: Partial<GasolinaRequestRow>): Promise<void> {
  const fields: string[] = []
  const values: any[] = []
  if (patch.status) { fields.push('status = ?'); values.push(patch.status); }
  if (patch.admin_note !== undefined) { fields.push('admin_note = ?'); values.push(patch.admin_note); }
  if (patch.error_message !== undefined) { fields.push('error_message = ?'); values.push(patch.error_message); }
  if (patch.admin_approver_id !== undefined) { fields.push('admin_approver_id = ?'); values.push(patch.admin_approver_id); }
  if (patch.admin_approver_name !== undefined) { fields.push('admin_approver_name = ?'); values.push(patch.admin_approver_name); }
  
  fields.push('updated_at = ?'); values.push(new Date());
  values.push(id)
  await pool.execute(`UPDATE telegram_gasolina_requests SET ${fields.join(', ')} WHERE id = ?`, values)
}

// --- ACLARACIONES ---

export async function insertAclaracion(input: {
  telegram_chat_id: number
  telegram_user_id: number | null
  solicitante_name: string | null
  comentario: string
}): Promise<string> {
  const id = randomUUID()
  await pool.execute(
    `INSERT INTO telegram_aclaraciones (id, telegram_chat_id, telegram_user_id, solicitante_name, comentario, created_at)
     VALUES (?,?,?,?,?,?)`,
    [id, input.telegram_chat_id, input.telegram_user_id, input.solicitante_name, input.comentario, new Date()]
  )
  return id
}
export type TopupRuleRow = {
  id: number
  efectivale_account_id: number
  cuenta: string
  alias: string | null
  min_saldo: number
  max_saldo: number
  frecuencia: string | null
  enabled: boolean
  inactive_reason: string | null
  notes: string | null
  short_code: number | null
  chofer_id: number | null
  vehiculo_id: number | null
  updated_at: Date
  // Campos extra de joins
  chofer_nombre?: string
  vehiculo_placas?: string
  account_alias?: string
}

// --- CHOFERES ---

export type ChoferRow = {
  id: number
  nombre: string
  activo: boolean
  fecha_creacion: Date
  fecha_actualizacion: Date
}

export async function listChoferes(allowedGroups?: number[], isAdmin?: boolean): Promise<any[]> {
  let query = `
    SELECT c.*, g.nombre as grupo_nombre,
           (SELECT GROUP_CONCAT(alias SEPARATOR ' | ') FROM telegram_topup_rules WHERE chofer_id = c.id) as tarjetas,
           (SELECT GROUP_CONCAT(DISTINCT v.placas SEPARATOR ' | ') 
            FROM telegram_topup_rules r 
            JOIN cv_vehiculos v ON r.vehiculo_id = v.id 
            WHERE r.chofer_id = c.id) as vehiculos
    FROM cv_choferes c 
    LEFT JOIN cv_grupos g ON c.grupo_id = g.id
    WHERE c.activo = 1 
  `
  const params: any[] = []
  if (!isAdmin && allowedGroups && allowedGroups.length > 0) {
    query += ` AND c.grupo_id IN (?) `
    params.push(allowedGroups)
  }
  
  query += ` ORDER BY c.nombre ASC`
  const [rows] = await pool.query<any[]>(query, params)
  return rows
}

export async function getChoferHistory(choferId: number): Promise<any[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM cv_historial_asignaciones WHERE chofer_id = ? ORDER BY fecha_inicio DESC`,
    [choferId]
  )
  return rows
}

export async function createChofer(nombre: string, grupoId?: number | null): Promise<number> {
  const [result]: any = await pool.execute(`INSERT INTO cv_choferes (nombre, grupo_id) VALUES (?, ?)`, [nombre, grupoId || null])
  return result.insertId
}

export async function updateChofer(id: number, nombre: string, grupoId?: number | null): Promise<void> {
  await pool.execute(`UPDATE cv_choferes SET nombre = ?, grupo_id = ? WHERE id = ?`, [nombre, grupoId || null, id])
}

export async function deleteChofer(id: number): Promise<void> {
  await pool.execute(`UPDATE cv_choferes SET activo = 0 WHERE id = ?`, [id])
}

export async function assignAssetsToChofer(choferId: number, vehicleId: number | null, cardCuenta: string | null): Promise<void> {
  // 1. Si hay una tarjeta, actualizar esa regla para ponerle este chofer y este vehiculo
  if (cardCuenta) {
    // Buscar la regla existente para no borrar sus datos
    const [existing]: any = await pool.query(`SELECT * FROM telegram_topup_rules WHERE cuenta = ?`, [cardCuenta])
    if (existing[0]) {
      const r = existing[0]
      await upsertTopupRuleMySql({
        ...r,
        chofer_id: choferId,
        vehiculo_id: vehicleId
      })
    }
  }
}

// --- VEHÍCULOS ---

export type VehiculoRow = {
  id: number
  placas: string
  modelo: string | null
  anio: number | null
  activo: boolean
  fecha_creacion: Date
  fecha_actualizacion: Date
}

export async function listVehiculos(allowedGroups?: number[], isAdmin?: boolean): Promise<any[]> {
  let query = `SELECT v.*, g.nombre as grupo_nombre FROM cv_vehiculos v LEFT JOIN cv_grupos g ON v.grupo_id = g.id WHERE v.activo = 1`
  const params: any[] = []
  
  if (!isAdmin && allowedGroups && allowedGroups.length > 0) {
    query += ` AND v.grupo_id IN (?)`
    params.push(allowedGroups)
  }
  
  query += ` ORDER BY v.placas ASC`
  const [rows] = await pool.query<any[]>(query, params)
  return rows
}

export async function createVehiculo(input: { placas: string, modelo?: string, anio?: number, grupo_id?: number | null }): Promise<number> {
  const [result]: any = await pool.execute(
    `INSERT INTO cv_vehiculos (placas, modelo, anio, grupo_id) VALUES (?, ?, ?, ?)`,
    [input.placas, input.modelo || null, input.anio || null, input.grupo_id || null]
  )
  return result.insertId
}

export async function updateVehiculo(id: number, patch: Partial<VehiculoRow> & { grupo_id?: number | null }): Promise<void> {
  const fields = []
  const values = []
  if (patch.placas !== undefined) { fields.push('placas = ?'); values.push(patch.placas); }
  if (patch.modelo !== undefined) { fields.push('modelo = ?'); values.push(patch.modelo); }
  if (patch.anio !== undefined) { fields.push('anio = ?'); values.push(patch.anio); }
  if (patch.grupo_id !== undefined) { fields.push('grupo_id = ?'); values.push(patch.grupo_id); }
  if (fields.length === 0) return
  values.push(id)
  await pool.execute(`UPDATE cv_vehiculos SET ${fields.join(', ')} WHERE id = ?`, values)
}

export async function deleteVehiculo(id: number): Promise<void> {
  await pool.execute(`UPDATE cv_vehiculos SET activo = 0 WHERE id = ?`, [id])
}

// --- REGLAS DE RECARGA ---

export async function listTopupRulesMySql(): Promise<TopupRuleRow[]> {
  const [rows] = await pool.query<any[]>(`
    SELECT r.*, 
           c.nombre as chofer_nombre, 
           v.placas as vehiculo_placas,
           acc.alias as account_alias,
           s.tarjeta as tarjeta_numero
    FROM telegram_topup_rules r
    LEFT JOIN cv_choferes c ON r.chofer_id = c.id
    LEFT JOIN cv_vehiculos v ON r.vehiculo_id = v.id
    LEFT JOIN efectivale_accounts acc ON r.efectivale_account_id = acc.id
    LEFT JOIN efectivale_saldo_rows s ON r.cuenta = s.cuenta
    ORDER BY r.short_code ASC, r.alias ASC
  `)
  return rows.map(r => ({
    ...r,
    min_saldo: Number(r.min_saldo),
    max_saldo: Number(r.max_saldo),
    short_code: r.short_code != null ? Number(r.short_code) : null,
    enabled: !!r.enabled,
    updated_at: new Date(r.updated_at)
  }))
}

export async function upsertTopupRuleMySql(rule: Partial<TopupRuleRow> & { cuenta: string, efectivale_account_id: number }) {
  const [existing]: any = await pool.query(`SELECT id, chofer_id, vehiculo_id FROM telegram_topup_rules WHERE cuenta = ?`, [rule.cuenta])
  
  const shortCode = rule.short_code ?? (rule.alias ? extractShortCode(rule.alias) : null)
  const newChoferId = rule.chofer_id ?? null
  const newVehiculoId = rule.vehiculo_id ?? null

  if (existing[0]) {
    const id = existing[0].id
    const oldChoferId = existing[0].chofer_id
    const oldVehiculoId = existing[0].vehiculo_id

    // 1. Manejo de cambios de Chofer (Cerrar asignación anterior si cambió)
    if (oldChoferId !== newChoferId) {
      if (oldChoferId) {
        // Cerrar Gasolina para el viejo
        await pool.execute(
          `UPDATE cv_historial_asignaciones SET fecha_fin = CURRENT_TIMESTAMP, activo = 0 
           WHERE chofer_id = ? AND tipo = 'GASOLINA' AND referencia = ? AND activo = 1`, 
          [oldChoferId, rule.cuenta]
        )
        // Cerrar Vehículo para el viejo (si lo tenía asignado vía esta tarjeta)
        if (oldVehiculoId) {
           await pool.execute(
             `UPDATE cv_historial_asignaciones SET fecha_fin = CURRENT_TIMESTAMP, activo = 0 
              WHERE chofer_id = ? AND tipo = 'VEHICULO' AND referencia = ? AND activo = 1`, 
             [oldChoferId, String(oldVehiculoId)]
           )
        }
      }
      
      // Abrir nuevas asignaciones para el nuevo chofer
      if (newChoferId) {
        await pool.execute(
          `INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) 
           VALUES (?, 'GASOLINA', ?, ?)`, 
          [newChoferId, rule.cuenta, rule.alias || 'Tarjeta']
        )
        if (newVehiculoId) {
          const [vRows]: any = await pool.query(`SELECT placas FROM cv_vehiculos WHERE id = ?`, [newVehiculoId])
          const placas = vRows[0]?.placas || 'Auto'
          await pool.execute(
            `INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) 
             VALUES (?, 'VEHICULO', ?, ?)`, 
            [newChoferId, String(newVehiculoId), placas]
          )
        }
      }
    } else if (oldVehiculoId !== newVehiculoId && newChoferId) {
      // Si el chofer es EL MISMO pero cambió el vehículo
      if (oldVehiculoId) {
        await pool.execute(
          `UPDATE cv_historial_asignaciones SET fecha_fin = CURRENT_TIMESTAMP, activo = 0 
           WHERE chofer_id = ? AND tipo = 'VEHICULO' AND referencia = ? AND activo = 1`, 
          [newChoferId, String(oldVehiculoId)]
        )
      }
      if (newVehiculoId) {
        const [vRows]: any = await pool.query(`SELECT placas FROM cv_vehiculos WHERE id = ?`, [newVehiculoId])
        const placas = vRows[0]?.placas || 'Auto'
        await pool.execute(
          `INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) 
           VALUES (?, 'VEHICULO', ?, ?)`, 
          [newChoferId, String(newVehiculoId), placas]
        )
      }
    }

    // Actualizar la regla principal
    await pool.execute(
      `UPDATE telegram_topup_rules SET 
        efectivale_account_id = ?, 
        alias = ?, 
        short_code = ?, 
        chofer_id = ?, 
        vehiculo_id = ?, 
        min_saldo = ?, 
        max_saldo = ?, 
        frecuencia = ?,
        modo_carga = ?,
        enabled = ?, 
        inactive_reason = ?,
        notes = ?,
        nip = ?
      WHERE id = ?`,
      [
        rule.efectivale_account_id, 
        rule.alias ?? null, 
        shortCode, 
        newChoferId, 
        newVehiculoId, 
        rule.min_saldo ?? 0, 
        rule.max_saldo ?? 0, 
        rule.frecuencia ?? 'A LIBRE DEMANDA',
        rule.modo_carga ?? 'COMPLETAR',
        rule.enabled ?? true, 
        rule.inactive_reason ?? null,
        rule.notes ?? null, 
        rule.nip ?? null,
        id
      ]
    )
    return id
  } else {
    // NUEVA REGLA (INSERT)
    const [result]: any = await pool.execute(
      `INSERT INTO telegram_topup_rules 
        (efectivale_account_id, cuenta, alias, short_code, chofer_id, vehiculo_id, min_saldo, max_saldo, frecuencia, modo_carga, enabled, inactive_reason, notes, nip) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.efectivale_account_id, 
        rule.cuenta, 
        rule.alias ?? null, 
        shortCode, 
        newChoferId, 
        newVehiculoId, 
        rule.min_saldo ?? 0, 
        rule.max_saldo ?? 0, 
        rule.frecuencia ?? 'A LIBRE DEMANDA',
        rule.modo_carga ?? 'COMPLETAR', 
        rule.enabled ?? true, 
        rule.inactive_reason ?? null,
        rule.notes ?? null,
        rule.nip ?? null
      ]
    )
    if (newChoferId) {
       await pool.execute(`INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) VALUES (?, 'GASOLINA', ?, ?)`, [newChoferId, rule.cuenta, rule.alias || 'Tarjeta'])
       if (newVehiculoId) {
         const [vRows]: any = await pool.query(`SELECT placas FROM cv_vehiculos WHERE id = ?`, [newVehiculoId])
         const placas = vRows[0]?.placas || 'Auto'
         await pool.execute(`INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) VALUES (?, 'VEHICULO', ?, ?)`, [newChoferId, String(newVehiculoId), placas])
       }
    }
    return result.insertId
  }
}

export async function logNipConsultation(usuario_id: number, cuenta: string, ip: string) {
  await pool.execute(
    `INSERT INTO sys_auditoria_nips (usuario_id, cuenta, ip_address) VALUES (?, ?, ?)`,
    [usuario_id, cuenta, ip]
  )
}

export async function getCardNip(cuenta: string): Promise<string | null> {
  const [rows]: any = await pool.execute(
    `SELECT nip FROM telegram_topup_rules WHERE cuenta = ?`,
    [cuenta]
  )
  return rows[0]?.nip || null
}

function extractShortCode(alias: string): number | null {
  const m = String(alias).match(/^\s*(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

export async function seedRulesFromSaldos() {
  const [saldos]: any = await pool.query(`
    SELECT cuenta, tarjeta, empleado, origen_label, efectivale_account_id
    FROM efectivale_saldo_rows
  `)
  let count = 0
  for (const s of saldos) {
    const alias = s.empleado || s.origen_label || s.tarjeta
    const shortCode = extractShortCode(alias)
    
    const [exists]: any = await pool.query(`SELECT id FROM telegram_topup_rules WHERE cuenta = ?`, [s.cuenta])
    if (!exists[0]) {
      await pool.execute(
        `INSERT INTO telegram_topup_rules (efectivale_account_id, cuenta, alias, short_code, max_saldo, enabled) VALUES (?, ?, ?, ?, ?, ?)`,
        [s.efectivale_account_id, s.cuenta, alias, shortCode, 0, 1]
      )
      count++
    } else {
      // Actualizar short_code si no existe
      await pool.execute(`UPDATE telegram_topup_rules SET short_code = ? WHERE cuenta = ? AND short_code IS NULL`, [shortCode, s.cuenta])
    }
  }
  return count
}

export async function deleteTopupRuleMySql(id: number): Promise<void> {
  await pool.execute(`DELETE FROM telegram_topup_rules WHERE id = ?`, [id])
}

export async function getCurrentAssignmentByCuenta(cuenta: string): Promise<{ chofer_id: number | null, vehiculo_id: number | null }> {
  // Buscar asignación de GASOLINA activa para esta cuenta
  const [gasRows]: any = await pool.query(
    `SELECT chofer_id FROM cv_historial_asignaciones 
     WHERE tipo = 'GASOLINA' AND referencia = ? AND activo = 1 
     ORDER BY fecha_inicio DESC LIMIT 1`, 
    [cuenta]
  );

  if (gasRows.length === 0) return { chofer_id: null, vehiculo_id: null };

  const chofer_id = gasRows[0].chofer_id;

  // Buscar si ese mismo chofer tiene un VEHICULO activo
  const [vehRows]: any = await pool.query(
    `SELECT referencia FROM cv_historial_asignaciones 
     WHERE tipo = 'VEHICULO' AND chofer_id = ? AND activo = 1 
     ORDER BY fecha_inicio DESC LIMIT 1`,
    [chofer_id]
  );

  const vehiculo_id = vehRows.length > 0 ? parseInt(vehRows[0].referencia, 10) : null;

  return { chofer_id, vehiculo_id };
}

// --- SESIONES DE TELEGRAM ---

export async function getTelegramSession(chatId: number): Promise<any | null> {
  const [rows] = await pool.query<any[]>(`SELECT step_json FROM telegram_bot_sessions WHERE chat_id = ?`, [chatId])
  if (!rows[0]) return null
  try {
    return JSON.parse(rows[0].step_json)
  } catch {
    return null
  }
}

export async function upsertTelegramSession(chatId: number, step: any): Promise<void> {
  const json = JSON.stringify(step)
  await pool.execute(
    `INSERT INTO telegram_bot_sessions (chat_id, step_json) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE step_json = VALUES(step_json), updated_at = CURRENT_TIMESTAMP`,
    [chatId, json]
  )
}

export async function deleteTelegramSession(chatId: number): Promise<void> {
  await pool.execute(`DELETE FROM telegram_bot_sessions WHERE chat_id = ?`, [chatId])
}

export async function getLatestSaldoByShortCode(shortCode: number) {
  const [rows] = await pool.query<any[]>(
    `SELECT r.cuenta, r.saldo, r.scraped_at, r.slot, r.origen_label, r.tarjeta
     FROM efectivale_saldo_rows r
     JOIN telegram_topup_rules t ON r.cuenta = t.cuenta
     WHERE t.short_code = ?`,
    [shortCode]
  )
  const r = rows[0]
  if (!r) return null
  return {
    cuenta: String(r.cuenta),
    saldo: r.saldo != null ? Number(r.saldo) : null,
    scrapedAt: new Date(r.scraped_at),
    slot: String(r.slot),
    origenLabel: r.origen_label,
    tarjeta: String(r.tarjeta ?? ''),
  }
}

export async function listLatestBalances(allowedGroups?: number[], isAdmin?: boolean): Promise<any[]> {
  let query = `
    SELECT 
      s.cuenta, 
      s.tarjeta, 
      COALESCE(r.alias, s.empleado, s.origen_label) as display_name, 
      r.short_code,
      r.efectivale_account_id,
      r.min_saldo,
      r.max_saldo,
      r.frecuencia,
      r.modo_carga,
      COALESCE(c.nombre, (SELECT ch.nombre FROM cv_choferes ch JOIN cv_historial_asignaciones ha ON ch.id = ha.chofer_id WHERE ha.referencia = s.cuenta AND ha.activo = 1 LIMIT 1)) as chofer_nombre,
      s.saldo, 
      s.scraped_at, 
      s.slot,
      acc.alias as account_alias
    FROM efectivale_saldo_rows s
    LEFT JOIN telegram_topup_rules r ON s.cuenta = r.cuenta
    LEFT JOIN cv_choferes c ON r.chofer_id = c.id
    LEFT JOIN cv_vehiculos v ON r.vehiculo_id = v.id
    LEFT JOIN efectivale_accounts acc ON s.efectivale_account_id = acc.id
  `
  
  const where: string[] = []
  const params: any[] = []

  if (!isAdmin && allowedGroups && allowedGroups.length > 0) {
    // Si no es admin, solo ver lo de sus grupos
    // Pero ojo: una tarjeta/chofer podría no tener grupo asignado (NULL). 
    // Usualmente el admin asume que si no hay grupo es GENERAL o solo admin.
    where.push(`(c.grupo_id IN (?) OR v.grupo_id IN (?))`)
    params.push(allowedGroups, allowedGroups)
  }

  if (where.length > 0) {
    query += ` WHERE ` + where.join(' AND ')
  }

  query += ` ORDER BY r.short_code ASC, display_name ASC`
  
  const [rows]: any = await pool.query(query, params)
  return rows
}

export async function createManualGasolinaMovement(data: {
  cuenta: string,
  monto: number,
  status: 'dispersed' | 'error',
  error_message?: string | null,
  chofer_id?: number | null,
  vehiculo_id?: number | null,
  tarjeta?: string | null,
  codigo_card?: string | null
}) {
  const [result]: any = await pool.execute(
    `INSERT INTO telegram_gasolina_requests 
      (id, telegram_chat_id, cuenta, monto, status, error_message, chofer_id, vehiculo_id, tarjeta, codigo_card, id_tipo, created_at, updated_at, admin_approver_name) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cuenta', NOW(), NOW(), 'DASHBOARD ADMIN')`,
    [
      randomUUID(), 
      0, 
      data.cuenta, 
      data.monto, 
      data.status, 
      data.error_message || null, 
      data.chofer_id || null, 
      data.vehiculo_id || null,
      data.tarjeta || null,
      data.codigo_card || null
    ]
  )
  return result.insertId
}

export async function updateWalletBalance(accountId: number, balance: number) {
  await pool.execute(
    `UPDATE efectivale_accounts SET wallet_balance = ?, last_wallet_sync = NOW() WHERE id = ?`,
    [balance, accountId]
  )
}

export async function getUserByEmail(email: string) {
  const [rows]: any = await pool.query(`
    SELECT u.*, 
           GROUP_CONCAT(DISTINCT p.codigo) as permisos,
           GROUP_CONCAT(DISTINCT ug.grupo_id) as grupos
    FROM sys_usuarios u
    LEFT JOIN sys_usuario_roles ur ON u.id = ur.usuario_id
    LEFT JOIN sys_roles r ON ur.rol_id = r.id
    LEFT JOIN sys_rol_permisos rp ON r.id = rp.rol_id
    LEFT JOIN sys_permisos p ON rp.permiso_id = p.id
    LEFT JOIN cv_usuario_grupos ug ON u.id = ug.usuario_id
    WHERE u.email = ? AND u.activo = 1
    GROUP BY u.id
  `, [email])
  
  if (!rows[0]) return null
  
  return {
    ...rows[0],
    permisos: rows[0].permisos ? rows[0].permisos.split(',') : [],
    grupos: rows[0].grupos ? rows[0].grupos.split(',').map(Number) : []
  }
}
