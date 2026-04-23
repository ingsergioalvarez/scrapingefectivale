"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config");
const db_1 = require("./db");
const accounts_1 = require("./modules/accounts");
const sessions_1 = require("./modules/sessions");
const scrape_1 = require("./modules/scrape");
const pase_data_1 = require("./modules/pase-data");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.get('/health', async (_req, res) => {
    try {
        await (0, db_1.pingDb)();
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
});
app.use('/api/accounts', accounts_1.accountsRouter);
app.use('/api/sessions', sessions_1.sessionsRouter);
app.use('/api/scrape', scrape_1.scrapeRouter);
app.use('/api/pase', pase_data_1.paseDataRouter);
app.listen(config_1.config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API escuchando en http://localhost:${config_1.config.port}`);
});
