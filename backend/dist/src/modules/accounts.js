"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const crypto_1 = require("../crypto");
const excel_store_1 = require("../store/excel-store");
const EfectivaleExtraSchema = zod_1.z
    .object({
    clienteId: zod_1.z.string().trim().min(1),
    consignatarioId: zod_1.z.string().trim().min(1),
})
    .partial();
const CreateAccountSchema = zod_1.z.object({
    alias: zod_1.z.string().trim().min(1).max(100).optional(),
    username: zod_1.z.string().trim().min(1).max(191),
    password: zod_1.z.string().min(1),
    notes: zod_1.z.string().max(5000).optional(),
    extra: zod_1.z.any().optional(),
});
const UpdateAccountSchema = zod_1.z.object({
    alias: zod_1.z.string().trim().min(1).max(100).nullable().optional(),
    username: zod_1.z.string().trim().min(1).max(191).optional(),
    password: zod_1.z.string().min(1).optional(),
    notes: zod_1.z.string().max(5000).nullable().optional(),
    extra: zod_1.z.any().optional(),
});
exports.accountsRouter = (0, express_1.Router)();
exports.accountsRouter.get('/', async (_req, res) => {
    const rows = await (0, excel_store_1.listAccounts)();
    res.json(rows.map((r) => ({
        id: r.id,
        app: r.app,
        alias: r.alias,
        username: r.username,
        notes: r.notes,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        hasSession: r.hasSession,
    })));
});
exports.accountsRouter.post('/', async (req, res) => {
    const parsed = CreateAccountSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const { alias, username, password, notes } = parsed.data;
    const app = 'efectivale';
    const passwordEnc = (0, crypto_1.encryptString)(password);
    const extraParsed = EfectivaleExtraSchema.safeParse(parsed.data.extra ?? {});
    if (!extraParsed.success || !extraParsed.data.clienteId || !extraParsed.data.consignatarioId) {
        return res.status(400).json({
            error: 'Debes capturar Cliente y Consignatario (Efectivale).',
        });
    }
    const extraJson = JSON.stringify(extraParsed.data);
    const id = await (0, excel_store_1.createAccount)({
        app,
        alias: alias ?? null,
        username,
        passwordEnc,
        extraJson,
        notes: notes ?? null,
    });
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
    const next = {};
    if (patch.alias !== undefined) {
        next.alias = patch.alias;
    }
    if (patch.username !== undefined) {
        next.username = patch.username;
    }
    if (patch.notes !== undefined) {
        next.notes = patch.notes;
    }
    if (patch.password !== undefined) {
        next.passwordEnc = (0, crypto_1.encryptString)(patch.password);
    }
    if (patch.extra !== undefined) {
        next.extraJson = patch.extra === null ? null : JSON.stringify(patch.extra);
    }
    if (Object.keys(next).length === 0)
        return res.json({ ok: true });
    const ok = await (0, excel_store_1.updateAccount)(id, next);
    if (!ok)
        return res.status(404).json({ error: 'Cuenta no encontrada' });
    res.json({ ok: true });
});
exports.accountsRouter.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id))
        return res.status(400).json({ error: 'id inválido' });
    await (0, excel_store_1.deleteAccount)(id);
    res.json({ ok: true });
});
