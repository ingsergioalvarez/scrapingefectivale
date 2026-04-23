import { pool } from '../db'
import { randomUUID } from 'node:crypto'

export type SaldoSlot = '05' | '17' | 'boot'

export function mysqlEnabled(): boolean {
  return !!(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE)
}

export async function ensureMysqlTables(): Promise<void> {
  // 1. Cuentas (Accesos)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS efectivale_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      app VARCHAR(32) NOT NULL,
      alias VARCHAR(255) NULL,
      username VARCHAR(255) NOT NULL,
      password_enc TEXT NOT NULL,
      extra_json TEXT NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_app_user (app, username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

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
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_status (status),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

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
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_cuenta (cuenta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Asegurar que la columna modo_carga existe (para bases de datos ya creadas)
  try {
    await pool.query(`ALTER TABLE telegram_topup_rules ADD COLUMN modo_carga VARCHAR(32) DEFAULT 'COMPLETAR' AFTER frecuencia;`)
  } catch (err) {
    // Si ya existe, fallará silenciosamente
  }

  // 7. Sesiones de Bot de Telegram
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_bot_sessions (
      chat_id BIGINT PRIMARY KEY,
      step_json TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 8. Choferes
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_choferes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 9. Vehículos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cv_vehiculos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      placas VARCHAR(20) NOT NULL UNIQUE,
      modelo VARCHAR(100) NULL,
      anio INT NULL,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

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

export async function listGasolinaRequests(status?: string): Promise<GasolinaRequestRow[]> {
  const [rows] = status 
    ? await pool.query<any[]>(`SELECT * FROM telegram_gasolina_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200`, [status])
    : await pool.query<any[]>(`SELECT * FROM telegram_gasolina_requests ORDER BY created_at DESC LIMIT 200`)
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

export async function listChoferes(): Promise<any[]> {
  const [rows] = await pool.query<any[]>(`
    SELECT c.*, 
           (SELECT GROUP_CONCAT(alias SEPARATOR ' | ') FROM telegram_topup_rules WHERE chofer_id = c.id) as tarjetas,
           (SELECT GROUP_CONCAT(DISTINCT v.placas SEPARATOR ' | ') 
            FROM telegram_topup_rules r 
            JOIN cv_vehiculos v ON r.vehiculo_id = v.id 
            WHERE r.chofer_id = c.id) as vehiculos
    FROM cv_choferes c 
    WHERE c.activo = 1 
    ORDER BY c.nombre ASC
  `)
  return rows
}

export async function getChoferHistory(choferId: number): Promise<any[]> {
  const [rows] = await pool.query<any[]>(
    `SELECT * FROM cv_historial_asignaciones WHERE chofer_id = ? ORDER BY fecha_inicio DESC`,
    [choferId]
  )
  return rows
}

export async function createChofer(nombre: string): Promise<number> {
  const [result]: any = await pool.execute(`INSERT INTO cv_choferes (nombre) VALUES (?)`, [nombre])
  return result.insertId
}

export async function updateChofer(id: number, nombre: string): Promise<void> {
  await pool.execute(`UPDATE cv_choferes SET nombre = ? WHERE id = ?`, [nombre, id])
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

export async function listVehiculos(): Promise<VehiculoRow[]> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM cv_vehiculos WHERE activo = 1 ORDER BY placas ASC`)
  return rows
}

export async function createVehiculo(input: { placas: string, modelo?: string, anio?: number }): Promise<number> {
  const [result]: any = await pool.execute(
    `INSERT INTO cv_vehiculos (placas, modelo, anio) VALUES (?, ?, ?)`,
    [input.placas, input.modelo || null, input.anio || null]
  )
  return result.insertId
}

export async function updateVehiculo(id: number, patch: Partial<VehiculoRow>): Promise<void> {
  const fields = []
  const values = []
  if (patch.placas !== undefined) { fields.push('placas = ?'); values.push(patch.placas); }
  if (patch.modelo !== undefined) { fields.push('modelo = ?'); values.push(patch.modelo); }
  if (patch.anio !== undefined) { fields.push('anio = ?'); values.push(patch.anio); }
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
           acc.alias as account_alias
    FROM telegram_topup_rules r
    LEFT JOIN cv_choferes c ON r.chofer_id = c.id
    LEFT JOIN cv_vehiculos v ON r.vehiculo_id = v.id
    LEFT JOIN efectivale_accounts acc ON r.efectivale_account_id = acc.id
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

    // Si cambió el chofer de la tarjeta
    if (oldChoferId !== newChoferId) {
      if (oldChoferId) { // Cerrar anterior
        await pool.execute(`UPDATE cv_historial_asignaciones SET fecha_fin = CURRENT_TIMESTAMP, activo = 0 WHERE chofer_id = ? AND tipo = 'GASOLINA' AND referencia = ? AND activo = 1`, [oldChoferId, rule.cuenta])
      }
      if (newChoferId) { // Abrir nuevo
        await pool.execute(`INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) VALUES (?, 'GASOLINA', ?, ?)`, [newChoferId, rule.cuenta, rule.alias || 'Tarjeta'])
      }
    }

    // Si cambió el vehículo asignado a esta regla (y por ende al chofer actual)
    if (oldVehiculoId !== newVehiculoId && newChoferId) {
       // Esto es más complejo porque el vehículo se asigna a la regla, no directamente al chofer.
       // Pero para efectos prácticos, si la regla tiene un chofer, registramos el cambio.
       if (oldVehiculoId) {
          await pool.execute(`UPDATE cv_historial_asignaciones SET fecha_fin = CURRENT_TIMESTAMP, activo = 0 WHERE chofer_id = ? AND tipo = 'VEHICULO' AND referencia = ? AND activo = 1`, [newChoferId, String(oldVehiculoId)])
       }
       if (newVehiculoId) {
          const [vRows]: any = await pool.query(`SELECT placas FROM cv_vehiculos WHERE id = ?`, [newVehiculoId])
          const placas = vRows[0]?.placas || 'Auto'
          await pool.execute(`INSERT INTO cv_historial_asignaciones (chofer_id, tipo, referencia, detalles) VALUES (?, 'VEHICULO', ?, ?)`, [newChoferId, String(newVehiculoId), placas])
       }
    }

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
        enabled = ?, 
        inactive_reason = ?,
        notes = ? 
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
        rule.enabled ?? true, 
        rule.inactive_reason ?? null,
        rule.notes ?? null, 
        id
      ]
    )
    return id
  } else {
    const [result]: any = await pool.execute(
      `INSERT INTO telegram_topup_rules 
        (efectivale_account_id, cuenta, alias, short_code, chofer_id, vehiculo_id, min_saldo, max_saldo, frecuencia, enabled, inactive_reason, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        rule.enabled ?? true, 
        rule.inactive_reason ?? null,
        rule.notes ?? null
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

export async function listLatestBalances(): Promise<any[]> {
  const [rows]: any = await pool.query(`
    SELECT 
      s.cuenta, 
      s.tarjeta, 
      COALESCE(r.alias, s.empleado, s.origen_label) as display_name, 
      r.short_code,
      r.min_saldo,
      r.max_saldo,
      r.frecuencia,
      c.nombre as chofer_nombre,
      s.saldo, 
      s.scraped_at, 
      s.slot,
      acc.alias as account_alias
    FROM efectivale_saldo_rows s
    LEFT JOIN telegram_topup_rules r ON s.cuenta = r.cuenta
    LEFT JOIN cv_choferes c ON r.chofer_id = c.id
    LEFT JOIN efectivale_accounts acc ON s.efectivale_account_id = acc.id
    ORDER BY r.short_code ASC, display_name ASC
  `)
  return rows
}
