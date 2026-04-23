"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("../db");
const crypto_1 = require("../crypto");
const AppEnum = zod_1.z.enum(['pase', 'efectivale']);
const CreateAccountSchema = zod_1.z.object({
    app: AppEnum,
    alias: zod_1.z.string().trim().min(1).max(100).optional(),
    username: zod_1.z.string().trim().min(1).max(191),
    password: zod_1.z.string().min(1),
    notes: zod_1.z.string().max(5000).optional(),
});
const UpdateAccountSchema = zod_1.z.object({
    alias: zod_1.z.string().trim().min(1).max(100).nullable().optional(),
    username: zod_1.z.string().trim().min(1).max(191).optional(),
    password: zod_1.z.string().min(1).optional(),
    notes: zod_1.z.string().max(5000).nullable().optional(),
});
exports.accountsRouter = (0, express_1.Router)();
exports.accountsRouter.get('/', async (_req, res) => {
    const [rows] = await db_1.pool.query(`
    SELECT a.id, a.app, a.alias, a.username, a.notes, a.created_at, a.updated_at,
           s.id as session_id
    FROM app_accounts a
    LEFT JOIN app_sessions s ON s.account_id = a.id
    ORDER BY a.id DESC
    `);
    res.json(rows.map((r) => ({
        id: Number(r.id),
        app: r.app,
        alias: r.alias ?? null,
        username: r.username,
        notes: r.notes ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        hasSession: !!r.session_id,
    })));
});
exports.accountsRouter.post('/', async (req, res) => {
    const parsed = CreateAccountSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { app, alias, username, password, notes } = parsed.data;
    const passwordEnc = (0, crypto_1.encryptString)(password);
    const [result] = await db_1.pool.execute(`
    INSERT INTO app_accounts (app, alias, username, password_enc, notes)
    VALUES (:app, :alias, :username, :password_enc, :notes)
    `, { app, alias: alias ?? null, username, password_enc: passwordEnc, notes: notes ?? null });
    const id = Number(result.insertId);
    res.status(201).json({ id });
});
exports.accountsRouter.patch('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        return res.status(400).json({ error: 'id inválido' });
    const parsed = UpdateAccountSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const patch = parsed.data;
    const fields = [];
    const params = { id };
    if (patch.alias !== undefined) {
        fields.push('alias = :alias');
        params.alias = patch.alias;
    }
    if (patch.username !== undefined) {
        fields.push('username = :username');
        params.username = patch.username;
    }
    if (patch.notes !== undefined) {
        fields.push('notes = :notes');
        params.notes = patch.notes;
    }
    if (patch.password !== undefined) {
        fields.push('password_enc = :password_enc');
        params.password_enc = (0, crypto_1.encryptString)(patch.password);
    }
    if (fields.length === 0)
        return res.json({ ok: true });
    await db_1.pool.execute(`
    UPDATE app_accounts
    SET ${fields.join(', ')}
    WHERE id = :id
    `, params);
    res.json({ ok: true });
});
exports.accountsRouter.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        return res.status(400).json({ error: 'id inválido' });
    await db_1.pool.execute('DELETE FROM app_accounts WHERE id = :id', { id });
    res.json({ ok: true });
});
