"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("../crypto");
const efectivale_1 = require("../scrapers/efectivale");
const excel_store_1 = require("../store/excel-store");
exports.scrapeRouter = (0, express_1.Router)();
const ScrapeEfectivaleSchema = zod_1.z.object({
    accountId: zod_1.z.number().int().positive(),
    debug: zod_1.z.boolean().optional(),
});
exports.scrapeRouter.post('/efectivale/empleados', async (req, res) => {
    const parsed = ScrapeEfectivaleSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { accountId, debug } = parsed.data;
    const acc = await (0, excel_store_1.getAccount)(accountId);
    if (!acc || acc.app !== 'efectivale')
        return res.status(404).json({ error: 'Cuenta Efectivale no encontrada' });
    let extra = {};
    try {
        extra = acc.extraJson ? JSON.parse(acc.extraJson) : {};
    }
    catch {
        extra = {};
    }
    const clienteId = String(extra.clienteId ?? '').trim();
    const consignatarioId = String(extra.consignatarioId ?? '').trim();
    if (!clienteId || !consignatarioId) {
        return res.status(400).json({ error: 'Faltan Cliente/Consignatario en la cuenta Efectivale (extraJson).' });
    }
    const usuario = acc.username;
    const password = (0, crypto_1.decryptString)(acc.passwordEnc);
    const existingSession = await (0, excel_store_1.getSession)(accountId);
    const storageState = existingSession ? JSON.parse(existingSession.storageStateJson) : undefined;
    try {
        const logLines = [];
        const r = await (0, efectivale_1.scrapeEfectivaleEmpleados)({
            creds: { clienteId, consignatarioId, usuario, password },
            storageState,
            debug: !!debug,
            log: (line) => {
                logLines.push(line);
                // eslint-disable-next-line no-console
                console.log(line);
            },
        });
        await (0, excel_store_1.upsertSession)(accountId, JSON.stringify(r.storageState));
        res.json({ ok: true, count: r.rows.length, rows: r.rows, scrapedAt: new Date().toISOString(), logs: r.logs });
    }
    catch (e) {
        res.status(502).json({
            error: 'No se pudo scrapear Efectivale',
            detail: e?.message ?? String(e),
        });
    }
});
