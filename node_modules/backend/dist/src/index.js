"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cron_1 = __importDefault(require("node-cron"));
const config_1 = require("./config");
const accounts_1 = require("./modules/accounts");
const sessions_1 = require("./modules/sessions");
const scrape_1 = require("./modules/scrape");
const reports_1 = require("./modules/reports");
const utils_1 = require("./modules/utils");
const admin_1 = require("./modules/admin");
const reporting_1 = require("./services/reporting");
const topup_1 = require("./services/topup");
const telegram_bot_1 = require("./services/telegram-bot");
const error_1 = require("./middleware/error");
const mysql_telegram_1 = require("./store/mysql-telegram");
const saldo_snapshot_1 = require("./services/saldo-snapshot");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.get('/health', async (_req, res) => {
    res.json({ ok: true });
});
app.use('/api/accounts', accounts_1.accountsRouter);
app.use('/api/sessions', sessions_1.sessionsRouter);
app.use('/api/scrape', scrape_1.scrapeRouter);
app.use('/api/reports', reports_1.reportsRouter);
app.use('/api/utils', utils_1.utilsRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use(error_1.errorMiddleware);
app.listen(config_1.config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API escuchando en http://localhost:${config_1.config.port}`);
});
if ((0, mysql_telegram_1.mysqlTelegramEnabled)()) {
    (0, mysql_telegram_1.ensureTelegramMysqlTables)().catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[mysql] no se pudieron crear/verificar tablas:', e?.message ?? e);
    });
}
function registerTelegramShutdownHooks() {
    const shutdown = () => {
        try {
            (0, telegram_bot_1.stopTelegramBot)();
        }
        catch {
            // ignore
        }
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
}
registerTelegramShutdownHooks();
// Bot de Telegram (si está configurado)
void (0, telegram_bot_1.startTelegramBot)()
    .then((r) => {
    if (r.started) {
        // eslint-disable-next-line no-console
        console.log('[telegram] bot iniciado');
    }
    else {
        // eslint-disable-next-line no-console
        console.log(`[telegram] no iniciado: ${r.reason}`);
    }
})
    .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[telegram] error al iniciar:', e?.message ?? e);
});
// Corte de saldos Efectivale 5:00 (hora local del servidor) → MySQL
node_cron_1.default.schedule('0 5 * * *', async () => {
    try {
        const r = await (0, saldo_snapshot_1.runEfectivaleSaldoSnapshot)('05');
        if ('skipped' in r) {
            // eslint-disable-next-line no-console
            console.log(`[saldo 5am] omitido: ${r.skipped}`);
        }
        else {
            // eslint-disable-next-line no-console
            console.log(`[saldo 5am] batch=${r.batchId} filas=${r.rows}`);
        }
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error('[saldo 5am] error:', e?.message ?? e);
    }
});
// Rutina diaria 5pm: corte de saldos Efectivale → MySQL
node_cron_1.default.schedule('0 17 * * *', async () => {
    try {
        const r2 = await (0, saldo_snapshot_1.runEfectivaleSaldoSnapshot)('17');
        if ('skipped' in r2) {
            // eslint-disable-next-line no-console
            console.log(`[saldo 5pm] omitido: ${r2.skipped}`);
        }
        else {
            // eslint-disable-next-line no-console
            console.log(`[saldo 5pm] batch=${r2.batchId} filas=${r2.rows}`);
        }
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error('[saldo 5pm] error:', e?.message ?? e);
    }
});
// Prueba: rutina diaria 1pm para reporte Efectivale (gasolina)
node_cron_1.default.schedule('0 13 * * *', async () => {
    try {
        const r = await (0, reporting_1.buildEfectivaleGasolinaReporteXlsx)();
        const emailed = await (0, reporting_1.maybeEmailReport)(r.filePath, 'Reporte Efectivale (gasolina)');
        // eslint-disable-next-line no-console
        console.log(`[reporte 1pm] efectivale generado: ${r.filePath} | total=$${r.totalSaldo.toFixed(2)} | ${emailed.emailed ? 'enviado' : 'no enviado'}`);
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error('[reporte 1pm] efectivale error:', e?.message ?? e);
    }
});
// Rutina viernes 5pm: autocompletar saldos (Efectivale) según TopupRules
node_cron_1.default.schedule('0 17 * * 5', async () => {
    try {
        const r = await (0, topup_1.runFridayTopupsEfectivale)({ debug: false });
        // eslint-disable-next-line no-console
        console.log(`[topup viernes 5pm] procesadas=${r.processed} recargas=${r.toppedUp}`);
    }
    catch (e) {
        // eslint-disable-next-line no-console
        console.error('[topup viernes 5pm] error:', e?.message ?? e);
    }
});
