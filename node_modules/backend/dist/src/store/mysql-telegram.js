"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlTelegramEnabled = mysqlTelegramEnabled;
exports.ensureTelegramMysqlTables = ensureTelegramMysqlTables;
exports.insertSaldoRows = insertSaldoRows;
exports.getLatestSaldoByCuenta = getLatestSaldoByCuenta;
exports.getLatestSaldoByTarjetaUltimos7 = getLatestSaldoByTarjetaUltimos7;
exports.createGasolinaRequest = createGasolinaRequest;
exports.listGasolinaRequests = listGasolinaRequests;
exports.getGasolinaRequest = getGasolinaRequest;
exports.updateGasolinaRequest = updateGasolinaRequest;
exports.insertAclaracion = insertAclaracion;
const db_1 = require("../db");
const node_crypto_1 = require("node:crypto");
function mysqlTelegramEnabled() {
    return !!(process.env.MYSQL_HOST && process.env.MYSQL_DATABASE);
}
async function ensureTelegramMysqlTables() {
    await db_1.pool.query(`
    CREATE TABLE IF NOT EXISTS efectivale_saldo_rows (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      batch_id VARCHAR(36) NOT NULL,
      slot VARCHAR(2) NOT NULL COMMENT '05 o 17 (hora local del servidor)',
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
  `);
    await db_1.pool.query(`
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
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      admin_note TEXT NULL,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL,
      INDEX idx_status (status),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
    await db_1.pool.query(`
    CREATE TABLE IF NOT EXISTS telegram_aclaraciones (
      id VARCHAR(36) PRIMARY KEY,
      telegram_chat_id BIGINT NOT NULL,
      telegram_user_id BIGINT NULL,
      solicitante_name VARCHAR(255) NULL,
      comentario TEXT NOT NULL,
      created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
async function insertSaldoRows(batchId, slot, scrapedAt, rows) {
    if (!rows.length)
        return;
    const sql = `INSERT INTO efectivale_saldo_rows
    (batch_id, slot, scraped_at, efectivale_account_id, origen_label, cuenta, tarjeta, empleado, usuario_parametros, saldo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const conn = await db_1.pool.getConnection();
    try {
        await conn.beginTransaction();
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
            ]);
        }
        await conn.commit();
    }
    catch (e) {
        await conn.rollback();
        throw e;
    }
    finally {
        conn.release();
    }
}
async function getLatestSaldoByCuenta(cuenta) {
    const [rows] = await db_1.pool.query(`SELECT saldo, scraped_at AS scrapedAt, slot, origen_label AS origenLabel, tarjeta
     FROM efectivale_saldo_rows
     WHERE cuenta = ?
     ORDER BY scraped_at DESC, id DESC
     LIMIT 1`, [cuenta.trim()]);
    const r = rows[0];
    if (!r)
        return null;
    return {
        saldo: r.saldo != null ? Number(r.saldo) : null,
        scrapedAt: new Date(r.scrapedAt),
        slot: String(r.slot),
        origenLabel: r.origenLabel ?? null,
        tarjeta: String(r.tarjeta ?? ''),
    };
}
async function getLatestSaldoByTarjetaUltimos7(ultimos7) {
    const u = String(ultimos7).replace(/\D/g, '').slice(-7);
    if (u.length !== 7)
        return null;
    const [rows] = await db_1.pool.query(`SELECT cuenta, saldo, scraped_at AS scrapedAt, slot, origen_label AS origenLabel, tarjeta
     FROM efectivale_saldo_rows
     WHERE RIGHT(REPLACE(tarjeta, ' ', ''), 7) = ?
     ORDER BY scraped_at DESC, id DESC
     LIMIT 1`, [u]);
    const r = rows[0];
    if (!r)
        return null;
    return {
        cuenta: String(r.cuenta),
        saldo: r.saldo != null ? Number(r.saldo) : null,
        scrapedAt: new Date(r.scrapedAt),
        slot: String(r.slot),
        origenLabel: r.origenLabel ?? null,
        tarjeta: String(r.tarjeta ?? ''),
    };
}
async function createGasolinaRequest(input) {
    const id = input.id ?? (0, node_crypto_1.randomUUID)();
    const now = new Date();
    await db_1.pool.execute(`INSERT INTO telegram_gasolina_requests
    (id, telegram_chat_id, telegram_user_id, solicitante_name, id_tipo, cuenta, tarjeta_ultimos7, tipo_carga, actividad, monto, status, admin_note, error_message, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
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
        input.status ?? 'pending',
        null,
        null,
        now,
        now,
    ]);
    return id;
}
async function listGasolinaRequests(status) {
    const [rows] = status
        ? await db_1.pool.query(`SELECT * FROM telegram_gasolina_requests WHERE status = ? ORDER BY created_at DESC LIMIT 200`, [status])
        : await db_1.pool.query(`SELECT * FROM telegram_gasolina_requests ORDER BY created_at DESC LIMIT 200`);
    return rows.map((r) => ({
        ...r,
        telegram_chat_id: Number(r.telegram_chat_id),
        telegram_user_id: r.telegram_user_id != null ? Number(r.telegram_user_id) : null,
        monto: Number(r.monto),
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
    }));
}
async function getGasolinaRequest(id) {
    const [rows] = await db_1.pool.query(`SELECT * FROM telegram_gasolina_requests WHERE id = ? LIMIT 1`, [id]);
    const r = rows[0];
    if (!r)
        return null;
    return {
        ...r,
        telegram_chat_id: Number(r.telegram_chat_id),
        telegram_user_id: r.telegram_user_id != null ? Number(r.telegram_user_id) : null,
        monto: Number(r.monto),
        created_at: new Date(r.created_at),
        updated_at: new Date(r.updated_at),
    };
}
async function updateGasolinaRequest(id, patch) {
    const cur = await getGasolinaRequest(id);
    if (!cur)
        return false;
    const status = patch.status ?? cur.status;
    const admin_note = patch.admin_note !== undefined ? patch.admin_note : cur.admin_note;
    const error_message = patch.error_message !== undefined ? patch.error_message : cur.error_message;
    await db_1.pool.execute(`UPDATE telegram_gasolina_requests SET status = ?, admin_note = ?, error_message = ?, updated_at = ? WHERE id = ?`, [status, admin_note, error_message, new Date(), id]);
    return true;
}
async function insertAclaracion(input) {
    const id = (0, node_crypto_1.randomUUID)();
    await db_1.pool.execute(`INSERT INTO telegram_aclaraciones (id, telegram_chat_id, telegram_user_id, solicitante_name, comentario, created_at)
     VALUES (?,?,?,?,?,?)`, [id, input.telegram_chat_id, input.telegram_user_id, input.solicitante_name, input.comentario, new Date()]);
    return id;
}
