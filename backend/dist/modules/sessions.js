"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const UpsertSessionSchema = zod_1.z.object({
    storageState: zod_1.z.any(),
});
exports.sessionsRouter = (0, express_1.Router)();
exports.sessionsRouter.get('/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!Number.isFinite(accountId))
        return res.status(400).json({ error: 'accountId inválido' });
    const [rows] = await db_1.pool.execute('SELECT storage_state_json, updated_at FROM app_sessions WHERE account_id = :accountId', { accountId });
    const r = rows[0];
    if (!r)
        return res.status(404).json({ error: 'No hay sesión' });
    res.json({ storageState: JSON.parse(r.storage_state_json), updatedAt: r.updated_at });
});
exports.sessionsRouter.post('/:accountId', async (req, res) => {
    const accountId = Number(req.params.accountId);
    if (!Number.isFinite(accountId))
        return res.status(400).json({ error: 'accountId inválido' });
    const parsed = UpsertSessionSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const storageStateJson = JSON.stringify(parsed.data.storageState);
    await db_1.pool.execute(`
    INSERT INTO app_sessions (account_id, storage_state_json)
    VALUES (:accountId, :storage_state_json)
    ON DUPLICATE KEY UPDATE storage_state_json = VALUES(storage_state_json)
    `, { accountId, storage_state_json: storageStateJson });
    res.json({ ok: true });
});
