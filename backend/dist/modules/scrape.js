"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const pase_1 = require("../scrapers/pase");
const ScrapePaseTagsSchema = zod_1.z.object({
    accountId: zod_1.z.number().int().positive(),
});
exports.scrapeRouter = (0, express_1.Router)();
exports.scrapeRouter.post('/pase/tags', async (req, res) => {
    const parsed = ScrapePaseTagsSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { accountId } = parsed.data;
    const [rows] = await db_1.pool.execute('SELECT storage_state_json FROM app_sessions WHERE account_id = :accountId', {
        accountId,
    });
    const r = rows[0];
    if (!r) {
        return res.status(409).json({
            error: 'Necesitas crear sesión primero',
            hint: 'Ejecuta: npm run pase:bootstrap -- --accountId=<id>',
        });
    }
    const storageState = JSON.parse(r.storage_state_json);
    let scraped;
    try {
        scraped = await (0, pase_1.scrapePaseTags)(storageState);
    }
    catch (e) {
        return res.status(502).json({
            error: 'No se pudo scrapear PASE (posible CAPTCHA/bloqueo o sesión vencida)',
            detail: e?.message ?? String(e),
        });
    }
    for (const row of scraped) {
        await db_1.pool.execute(`
      INSERT INTO pase_tags (account_id, tag, no_economico, placas, clase, tipo, estatus, saldo)
      VALUES (:accountId, :tag, :no_economico, :placas, :clase, :tipo, :estatus, :saldo)
      ON DUPLICATE KEY UPDATE
        no_economico = VALUES(no_economico),
        placas = VALUES(placas),
        clase = VALUES(clase),
        tipo = VALUES(tipo),
        estatus = VALUES(estatus),
        saldo = VALUES(saldo),
        scraped_at = CURRENT_TIMESTAMP
      `, {
            accountId,
            tag: row.tag,
            no_economico: row.noEconomico,
            placas: row.placas,
            clase: row.clase,
            tipo: row.tipo,
            estatus: row.estatus,
            saldo: row.saldo,
        });
    }
    res.json({ ok: true, count: scraped.length });
});
exports.scrapeRouter.post('/efectivale/placeholder', async (_req, res) => {
    res.status(501).json({
        error: 'Efectivale todavía no está implementado (faltan URL y pantallas objetivo).',
    });
});
