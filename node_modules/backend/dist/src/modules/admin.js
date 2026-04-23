"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const mysql_telegram_1 = require("../store/mysql-telegram");
const telegram_helpers_1 = require("../services/telegram-helpers");
const telegram_notify_1 = require("../services/telegram-notify");
exports.adminRouter = (0, express_1.Router)();
function adminAuth(req, res, next) {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
        res.status(503).json({ error: 'ADMIN_API_KEY no configurado en el servidor' });
        return;
    }
    const key = String(req.headers['x-admin-key'] ?? '');
    if (key !== expected) {
        res.status(401).json({ error: 'No autorizado' });
        return;
    }
    next();
}
exports.adminRouter.use(adminAuth);
exports.adminRouter.get('/mysql-status', (_req, res) => {
    res.json({ enabled: (0, mysql_telegram_1.mysqlTelegramEnabled)() });
});
exports.adminRouter.get('/gasolina', async (req, res) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const rows = await (0, mysql_telegram_1.listGasolinaRequests)(status);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
    }
});
exports.adminRouter.post('/gasolina/:id/approve', async (req, res) => {
    try {
        const row = await (0, mysql_telegram_1.getGasolinaRequest)(req.params.id);
        if (!row || row.status !== 'pending') {
            res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
            return;
        }
        const note = req.body?.note != null ? String(req.body.note) : null;
        const payload = {
            requestedMonto: row.monto,
            debug: false,
        };
        if (row.id_tipo === 'cuenta') {
            if (!row.cuenta) {
                res.status(400).json({ error: 'Solicitud sin cuenta' });
                return;
            }
            payload.cuenta = row.cuenta;
        }
        else {
            if (!row.tarjeta_ultimos7) {
                res.status(400).json({ error: 'Solicitud sin tarjeta' });
                return;
            }
            payload.tarjetaUltimos7 = row.tarjeta_ultimos7;
        }
        const result = await (0, telegram_helpers_1.runSingleTopupRequest)(payload);
        await (0, mysql_telegram_1.updateGasolinaRequest)(row.id, { status: 'dispersed', admin_note: note, error_message: null });
        await (0, telegram_notify_1.notifyTelegramUser)(row.telegram_chat_id, `Tu carga de gasolina ya fue dispersada.\n${result.message}\n\nGracias por usar mis servicios.`);
        res.json({ ok: true, result });
    }
    catch (e) {
        try {
            const row = await (0, mysql_telegram_1.getGasolinaRequest)(req.params.id);
            if (row)
                await (0, mysql_telegram_1.updateGasolinaRequest)(row.id, { status: 'error', error_message: e?.message ?? String(e) });
            if (row) {
                await (0, telegram_notify_1.notifyTelegramUser)(row.telegram_chat_id, `No se pudo completar tu recarga: ${e?.message ?? e}\n\nGracias por usar mis servicios.`);
            }
        }
        catch {
            // ignore
        }
        res.status(502).json({ error: e?.message ?? String(e) });
    }
});
exports.adminRouter.post('/gasolina/:id/reject', async (req, res) => {
    try {
        const row = await (0, mysql_telegram_1.getGasolinaRequest)(req.params.id);
        if (!row || row.status !== 'pending') {
            res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' });
            return;
        }
        const note = req.body?.note != null ? String(req.body.note) : null;
        await (0, mysql_telegram_1.updateGasolinaRequest)(row.id, { status: 'rejected', admin_note: note });
        await (0, telegram_notify_1.notifyTelegramUser)(row.telegram_chat_id, `Tu solicitud de gasolina no fue autorizada.${note ? ` Nota: ${note}` : ''}\n\nGracias por usar mis servicios.`);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ error: e?.message ?? String(e) });
    }
});
