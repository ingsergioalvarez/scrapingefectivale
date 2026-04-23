"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const excel_store_1 = require("../store/excel-store");
const UpsertSessionSchema = zod_1.z.object({
    storageState: zod_1.z.any(),
});
exports.sessionsRouter = (0, express_1.Router)();
exports.sessionsRouter.get('/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!Number.isFinite(accountId))
        return res.status(400).json({ error: 'accountId inválido' });
    const r = await (0, excel_store_1.getSession)(accountId);
    if (!r)
        return res.status(404).json({ error: 'No hay sesión' });
    res.json({ storageState: JSON.parse(r.storageStateJson), updatedAt: r.updatedAt });
});
exports.sessionsRouter.post('/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!Number.isFinite(accountId))
        return res.status(400).json({ error: 'accountId inválido' });
    const parsed = UpsertSessionSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const storageStateJson = JSON.stringify(parsed.data.storageState);
    await (0, excel_store_1.upsertSession)(accountId, storageStateJson);
    res.json({ ok: true });
});
