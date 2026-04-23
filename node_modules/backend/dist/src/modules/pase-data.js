"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paseDataRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
exports.paseDataRouter = (0, express_1.Router)();
const QuerySchema = zod_1.z.object({
    accountId: zod_1.z.coerce.number().int().positive(),
});
exports.paseDataRouter.get('/tags', async (req, res) => {
    const parsed = QuerySchema.safeParse(req.query);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { accountId } = parsed.data;
    const [rows] = await db_1.pool.execute(`
    SELECT tag, no_economico, placas, clase, tipo, estatus, saldo, scraped_at
    FROM pase_tags
    WHERE account_id = :accountId
    ORDER BY tag ASC
    `, { accountId });
    res.json(rows.map((r) => ({
        tag: r.tag,
        noEconomico: r.no_economico ?? null,
        placas: r.placas ?? null,
        clase: r.clase ?? null,
        tipo: r.tipo ?? null,
        estatus: r.estatus ?? null,
        saldo: r.saldo === null ? null : Number(r.saldo),
        scrapedAt: r.scraped_at,
    })));
});
