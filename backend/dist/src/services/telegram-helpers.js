"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSingleTopupRequest = runSingleTopupRequest;
const crypto_1 = require("../crypto");
const excel_store_1 = require("../store/excel-store");
const efectivale_1 = require("../scrapers/efectivale");
const topup_1 = require("./topup");
const mysql_telegram_1 = require("../store/mysql-telegram");
function normalizeCuenta(s) {
    return String(s ?? '')
        .replace(/\s+/g, '')
        .trim();
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
async function runSingleTopupRequest(args) {
    let cuenta = args.cuenta ? normalizeCuenta(args.cuenta) : '';
    if (args.tarjetaUltimos7) {
        if (!(0, mysql_telegram_1.mysqlTelegramEnabled)())
            throw new Error('Para recargar por tarjeta se requiere MySQL y cortes de saldo (5:00 y 17:00).');
        const hit = await (0, mysql_telegram_1.getLatestSaldoByTarjetaUltimos7)(args.tarjetaUltimos7);
        if (!hit) {
            throw new Error('No encontré esos últimos 7 dígitos en el último corte. Verifica o espera al siguiente corte (5:00 o 17:00).');
        }
        cuenta = normalizeCuenta(hit.cuenta);
    }
    if (!cuenta)
        throw new Error('Falta número de cuenta.');
    const rules = (await (0, excel_store_1.listTopupRules)()).filter((r) => r.enabled);
    const rule = rules.find((r) => normalizeCuenta(r.cuenta) === cuenta);
    if (!rule)
        throw new Error('Cuenta no registrada en TopupRules.');
    const account = await (0, excel_store_1.getAccount)(rule.efectivaleAccountId);
    if (!account || account.app !== 'efectivale')
        throw new Error('Login Efectivale no encontrado para esa regla.');
    let extra = {};
    try {
        extra = account.extraJson ? JSON.parse(account.extraJson) : {};
    }
    catch {
        extra = {};
    }
    const clienteId = String(extra.clienteId ?? '').trim();
    const consignatarioId = String(extra.consignatarioId ?? '').trim();
    if (!clienteId || !consignatarioId)
        throw new Error('Faltan cliente/consignatario en el acceso Efectivale.');
    const password = (0, crypto_1.decryptString)(account.passwordEnc);
    const sess = await (0, excel_store_1.getSession)(account.id);
    const storageState = sess ? JSON.parse(sess.storageStateJson) : undefined;
    // Consultar saldo actual para aplicar límites
    const scraped = await (0, efectivale_1.scrapeEfectivaleEmpleados)({
        creds: { clienteId, consignatarioId, usuario: account.username, password },
        storageState,
        debug: !!args.debug,
    });
    const row = scraped.rows.find((r) => normalizeCuenta(r.cuenta) === cuenta);
    const saldo = row?.saldo ?? null;
    if (saldo == null) {
        await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
        throw new Error('No pude leer el saldo de esa cuenta.');
    }
    const maxSaldo = Number(rule.maxSaldo ?? 0);
    const minSaldo = Number(rule.minSaldo ?? 0);
    if (!(maxSaldo > 0) || !(maxSaldo >= minSaldo)) {
        await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
        throw new Error('Regla inválida (maxSaldo/minSaldo).');
    }
    // Cap por máximo
    const maxAllowedMonto = round2(Math.max(0, maxSaldo - saldo));
    const requested = round2(args.requestedMonto);
    const monto = Math.min(requested, maxAllowedMonto);
    if (monto <= 0.01) {
        await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
        return {
            cuentaUsada: cuenta,
            message: `Sin recarga: saldo actual $${saldo.toFixed(2)} ya está en/arriba del máximo ($${maxSaldo.toFixed(2)}).`,
        };
    }
    const d = await (0, topup_1.efectivaleDispersarCuenta)({
        creds: { clienteId, consignatarioId, usuario: account.username, password },
        storageState: scraped.storageState,
        cuenta,
        monto,
        debug: !!args.debug,
    });
    await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(d.storageState));
    return {
        cuentaUsada: cuenta,
        message: `Recarga ejecutada: cuenta ${cuenta} | saldo $${saldo.toFixed(2)} | solicitado $${requested.toFixed(2)} | aplicado $${monto.toFixed(2)} (máximo $${maxSaldo.toFixed(2)}).`,
    };
}
