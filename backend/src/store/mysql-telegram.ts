import { pool } from '../db'
import { randomUUID } from 'node:crypto'

export type SaldoSlot = '05' | '17' | 'boot'

export function mysqlTelegramEnabled(): boolean {
  return !!(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE)
}

export async function ensureTelegramMysqlTables(): Promise<void> {
  // 1. Saldos
  await pool.query(`
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
  `)

  // 2. Solicitudes Gasolina
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
      error_message TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_status (status),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // 3. Aclaraciones
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

  // 4. Reglas de Recarga (NUEVA)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_topup_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      efectivale_account_id INT NOT NULL,
      cuenta VARCHAR(32) NOT NULL,
      alias VARCHAR(255) NULL,
      min_saldo DECIMAL(12,2) DEFAULT 0,
      max_saldo DECIMAL(12,2) DEFAULT 0,
      enabled BOOLEAN DEFAULT TRUE,
      notes TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX idx_cuenta (cuenta)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `)

  // Asegurar que la columna slot sea lo suficientemente ancha para 'boot'
  try {
    await pool.query('ALTER TABLE efectivale_saldo_rows MODIFY COLUMN slot VARCHAR(10)')
  } catch {
    // ignore
  }
}

export async function insertSaldoRows(
  batchId: string,
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
    (batch_id, slot, scraped_at, efectivale_account_id, origen_label, cuenta, tarjeta, empleado, usuario_parametros, saldo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    for (const r of rows) {
      await conn.execute(sql, [
        batchId,
        slot,
        scrapedAt,
        r.efectivaleAccountId,
        r.origenLabel,
        r.cuenta,
        r.tarjeta,
        r.empleado,
        r.usuarioParametros,
        r.saldo,
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

export async function getLatestSaldoByCuenta(cuenta: string): Promise<{
  saldo: number | null
  scrapedAt: Date
  slot: string
  origenLabel: string | null
  tarjeta: string
} | null> {
  const [rows] = await pool.query<any[]>(
    `SELECT saldo, scraped_at AS scrapedAt, slot, origen_label AS origenLabel, tarjeta
     FROM efectivale_saldo_rows
     WHERE cuenta = ?
     ORDER BY scraped_at DESC, id DESC
     LIMIT 1`,
    [cuenta.trim()]
  )
  const r = rows[0]
  if (!r) return null
  return {
    saldo: r.saldo != null ? Number(r.saldo) : null,
    scrapedAt: new Date(r.scrapedAt),
    slot: String(r.slot),
    origenLabel: r.origenLabel ?? null,
    tarjeta: String(r.tarjeta ?? ''),
  }
}

export async function getLatestSaldoByTarjetaUltimos7(ultimos7: string): Promise<{
  cuenta: string
  saldo: number | null
  scrapedAt: Date
  slot: string
  origenLabel: string | null
  tarjeta: string
} | null> {
  const u = String(ultimos7).replace(/\D/g, '').slice(-7)
  if (u.length !== 7) return null
  const [rows] = await pool.query<any[]>(
    `SELECT cuenta, saldo, scraped_at AS scrapedAt, slot, origen_label AS origenLabel, tarjeta
     FROM efectivale_saldo_rows
     WHERE RIGHT(REPLACE(tarjeta, ' ', ''), 7) = ?
     ORDER BY scraped_at DESC, id DESC
     LIMIT 1`,
    [u]
  )
  const r = rows[0]
  if (!r) return null
  return {
    cuenta: String(r.cuenta),
    saldo: r.saldo != null ? Number(r.saldo) : null,
    scrapedAt: new Date(r.scrapedAt),
    slot: String(r.slot),
    origenLabel: r.origenLabel ?? null,
    tarjeta: String(r.tarjeta ?? ''),
  }
}

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
  error_message: string | null
  created_at: Date
  updated_at: Date
}

export async function createGasolinaRequest(
  input: Omit<GasolinaRequestRow, 'created_at' | 'updated_at' | 'admin_note' | 'error_message' | 'status'> & {
    id?: string
    status?: string
  }
): Promise<string> {
  const id = input.id ?? randomUUID()
  const now = new Date()
  await pool.execute(
    `INSERT INTO telegram_gasolina_requests
    (id, telegram_chat_id, telegram_user_id, solicitante_name, id_tipo, cuenta, tarjeta_ultimos7, tipo_carga, actividad, monto, saldo_actual_scraped, max_saldo_regla, status, admin_note, error_message, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.telegram_chat_id,
      input.telegram_user_id,
      input.solicitante_name,
      input.id_tipo,
      input.cuenta,
      input.tarjeta_ultimos7,
      input.tipo_carga,
      input.actividad,
      input.monto,
      input.saldo_actual_scraped ?? null,
      input.max_saldo_regla ?? null,
      input.status ?? 'pending',
      null,
      null,
      now,
      now,
    ]
  )
  return id
}

export async function listGasolinaRequests(status?: string): Promise<GasolinaRequestRow[]> {
  const [rows] = status
    ? await pool.query<any[]>(
        `SELECT * FROM telegram_gasolina_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200`,
        [status]
      )
    : await pool.query<any[]>(`SELECT * FROM telegram_gasolina_requests ORDER BY created_at DESC LIMIT 200`)
  return rows.map((r) => ({
    ...r,
    telegram_chat_id: Number(r.telegram_chat_id),
    telegram_user_id: r.telegram_user_id != null ? Number(r.telegram_user_id) : null,
    monto: Number(r.monto),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
  }))
}

export async function getGasolinaRequest(id: string): Promise<GasolinaRequestRow | null> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM telegram_gasolina_requests WHERE id = ? LIMIT 1`, [id])
  const r = rows[0]
  if (!r) return null
  return {
    ...r,
    telegram_chat_id: Number(r.telegram_chat_id),
    telegram_user_id: r.telegram_user_id != null ? Number(r.telegram_user_id) : null,
    monto: Number(r.monto),
    created_at: new Date(r.created_at),
    updated_at: new Date(r.updated_at),
  }
}

export async function updateGasolinaRequest(
  id: string,
  patch: Partial<Pick<GasolinaRequestRow, 'status' | 'admin_note' | 'error_message'>>
) {
  const cur = await getGasolinaRequest(id)
  if (!cur) return false
  const status = patch.status ?? cur.status
  const admin_note = patch.admin_note !== undefined ? patch.admin_note : cur.admin_note
  const error_message = patch.error_message !== undefined ? patch.error_message : cur.error_message
  await pool.execute(
    `UPDATE telegram_gasolina_requests SET status = ?, admin_note = ?, error_message = ?, updated_at = ? WHERE id = ?`,
    [status, admin_note, error_message, new Date(), id]
  )
  return true
}

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

// --- REGLAS DE RECARGA ---

export type TopupRuleRow = {
  id: number
  efectivale_account_id: number
  cuenta: string
  alias: string | null
  min_saldo: number
  max_saldo: number
  enabled: boolean
  notes: string | null
  updated_at: Date
}

export async function listTopupRulesMySql(): Promise<TopupRuleRow[]> {
  const [rows] = await pool.query<any[]>(`SELECT * FROM telegram_topup_rules ORDER BY id DESC`)
  return rows.map((r) => ({
    ...r,
    min_saldo: Number(r.min_saldo),
    max_saldo: Number(r.max_saldo),
    enabled: !!r.enabled,
    updated_at: new Date(r.updated_at),
  }))
}

export async function upsertTopupRuleMySql(rule: Partial<TopupRuleRow> & { cuenta: string; efectivale_account_id: number }) {
  const [existing]: any = await pool.query(`SELECT id FROM telegram_topup_rules WHERE cuenta = ?`, [rule.cuenta])
  if (existing[0]) {
    const id = existing[0].id
    await pool.execute(
      `UPDATE telegram_topup_rules SET 
        efectivale_account_id = ?, 
        alias = ?, 
        min_saldo = ?, 
        max_saldo = ?, 
        enabled = ?, 
        notes = ?
       WHERE id = ?`,
      [
        rule.efectivale_account_id,
        rule.alias ?? null,
        rule.min_saldo ?? 0,
        rule.max_saldo ?? 0,
        rule.enabled ?? true,
        rule.notes ?? null,
        id,
      ]
    )
    return id
  } else {
    const [result]: any = await pool.execute(
      `INSERT INTO telegram_topup_rules 
        (efectivale_account_id, cuenta, alias, min_saldo, max_saldo, enabled, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.efectivale_account_id,
        rule.cuenta,
        rule.alias ?? null,
        rule.min_saldo ?? 0,
        rule.max_saldo ?? 0,
        rule.enabled ?? true,
        rule.notes ?? null,
      ]
    )
    return result.insertId
  }
}

export async function deleteTopupRuleMySql(id: number) {
  await pool.execute(`DELETE FROM telegram_topup_rules WHERE id = ?`, [id])
}

export async function seedRulesFromSaldos() {
  const [saldos]: any = await pool.query(`
    SELECT DISTINCT cuenta, tarjeta, empleado, origen_label, efectivale_account_id
    FROM efectivale_saldo_rows
    WHERE id IN (
      SELECT MAX(id) FROM efectivale_saldo_rows GROUP BY cuenta
    )
  `)

  let count = 0
  for (const s of saldos) {
    const [exists]: any = await pool.query(`SELECT id FROM telegram_topup_rules WHERE cuenta = ?`, [s.cuenta])
    if (!exists[0]) {
      await pool.execute(
        `INSERT INTO telegram_topup_rules (efectivale_account_id, cuenta, alias, max_saldo, enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [s.efectivale_account_id, s.cuenta, s.empleado || s.origen_label || s.tarjeta, 0, 1]
      )
      count++
    }
  }
  return count
}
