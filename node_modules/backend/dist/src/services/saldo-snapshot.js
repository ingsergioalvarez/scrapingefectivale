"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEfectivaleSaldoSnapshot = runEfectivaleSaldoSnapshot;
const excel_store_1 = require("../store/excel-store");
const crypto_1 = require("../crypto");
const efectivale_1 = require("../scrapers/efectivale");
const node_crypto_1 = require("node:crypto");
const mysql_telegram_1 = require("../store/mysql-telegram");
/**
 * Ejecuta scraping Efectivale y guarda todos los saldos en MySQL (corte 05 o 17 hora local del servidor).
 */
async function runEfectivaleSaldoSnapshot(slot) {
    if (!(0, mysql_telegram_1.mysqlTelegramEnabled)())
        return { skipped: 'MySQL no configurado' };
    const batchId = (0, node_crypto_1.randomUUID)();
    const scrapedAt = new Date();
    const all = await (0, excel_store_1.listAccounts)();
    const accounts = all.filter((a) => a.app === 'efectivale').sort((a, b) => a.id - b.id);
    const flat = [];
    for (const a of accounts) {
        let extra = {};
        try {
            extra = a.extraJson ? JSON.parse(a.extraJson) : {};
        }
        catch {
            extra = {};
        }
        const clienteId = String(extra.clienteId ?? '').trim();
        const consignatarioId = String(extra.consignatarioId ?? '').trim();
        if (!clienteId || !consignatarioId)
            continue;
        const password = (0, crypto_1.decryptString)(a.passwordEnc);
        const existingSession = await (0, excel_store_1.getSession)(a.id);
        const storageState = existingSession ? JSON.parse(existingSession.storageStateJson) : undefined;
        const r = await (0, efectivale_1.scrapeEfectivaleEmpleados)({
            creds: { clienteId, consignatarioId, usuario: a.username, password },
            storageState,
            debug: false,
        });
        await (0, excel_store_1.upsertSession)(a.id, JSON.stringify(r.storageState));
        const origenLabel = a.alias ? `${a.alias} (${a.username})` : a.username;
        for (const row of r.rows) {
            flat.push({
                efectivaleAccountId: a.id,
                origenLabel,
                cuenta: row.cuenta,
                tarjeta: row.tarjeta,
                empleado: row.empleado,
                usuarioParametros: row.usuarioParametros,
                saldo: row.saldo,
            });
        }
    }
    await (0, mysql_telegram_1.insertSaldoRows)(batchId, slot, scrapedAt, flat);
    return { batchId, rows: flat.length };
}
