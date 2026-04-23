"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const reporting_1 = require("../services/reporting");
exports.reportsRouter = (0, express_1.Router)();
let lastEfectivale = null;
exports.reportsRouter.post('/efectivale/run-now', async (_req, res) => {
    const r = await (0, reporting_1.buildEfectivaleGasolinaReporteXlsx)();
    await (0, reporting_1.maybeEmailReport)(r.filePath, 'Reporte Efectivale (gasolina)');
    lastEfectivale = {
        filePath: r.filePath,
        createdAt: new Date().toISOString(),
        totalSaldo: r.totalSaldo,
        cuentas: r.cuentas,
        empleados: r.empleados,
    };
    res.json({ ok: true, ...lastEfectivale });
});
exports.reportsRouter.get('/efectivale/last', async (_req, res) => {
    if (lastEfectivale)
        return res.json(lastEfectivale);
    const dir = node_path_1.default.resolve(process.cwd(), 'reports');
    if (!node_fs_1.default.existsSync(dir))
        return res.status(404).json({ error: 'Sin reportes' });
    const files = node_fs_1.default
        .readdirSync(dir)
        .filter((f) => f.startsWith('reporte-efectivale-gasolina-') && f.endsWith('.xlsx'))
        .map((f) => ({ f, t: node_fs_1.default.statSync(node_path_1.default.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);
    if (!files.length)
        return res.status(404).json({ error: 'Sin reportes Efectivale' });
    res.json({ filePath: node_path_1.default.join(dir, files[0].f), createdAt: new Date(files[0].t).toISOString() });
});
