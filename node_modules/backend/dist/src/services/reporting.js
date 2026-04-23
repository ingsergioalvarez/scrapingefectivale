"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEfectivaleGasolinaReporteXlsx = buildEfectivaleGasolinaReporteXlsx;
exports.maybeEmailReport = maybeEmailReport;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const exceljs_1 = __importDefault(require("exceljs"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const excel_store_1 = require("../store/excel-store");
const crypto_1 = require("../crypto");
const efectivale_1 = require("../scrapers/efectivale");
function getEmailConfig() {
    const host = process.env.REPORT_SMTP_HOST;
    const port = process.env.REPORT_SMTP_PORT;
    const user = process.env.REPORT_SMTP_USER;
    const pass = process.env.REPORT_SMTP_PASS;
    const from = process.env.REPORT_SMTP_FROM;
    const to = process.env.REPORT_SMTP_TO;
    const secure = (process.env.REPORT_SMTP_SECURE ?? 'false').toLowerCase() === 'true';
    if (!host || !port || !user || !pass || !from || !to)
        return null;
    return { host, port: Number(port), user, pass, from, to, secure };
}
function ensureReportsDir() {
    const dir = node_path_1.default.resolve(process.cwd(), 'reports');
    node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
function todayStamp(d = new Date()) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}
async function buildEfectivaleGasolinaReporteXlsx() {
    const all = await (0, excel_store_1.listAccounts)();
    const accounts = all.filter((a) => a.app === 'efectivale').sort((a, b) => a.id - b.id);
    const wb = new exceljs_1.default.Workbook();
    wb.creator = 'Control Vehicular';
    wb.created = new Date();
    const sheet = wb.addWorksheet('Efectivale');
    sheet.columns = [
        { header: 'Cuenta', key: 'cuenta', width: 14 },
        { header: 'Tarjeta', key: 'tarjeta', width: 14 },
        { header: 'Empleado', key: 'empleado', width: 35 },
        { header: 'Usuario Parametros', key: 'usuarioParametros', width: 28 },
        { header: 'Saldo', key: 'saldo', width: 14 },
        { header: 'Origen (login)', key: 'origen', width: 30 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getColumn('saldo').numFmt = '$#,##0.00';
    let total = 0;
    let cuentas = 0;
    let empleados = 0;
    for (const a of accounts) {
        let extra = {};
        try {
            extra = a.extraJson ? JSON.parse(a.extraJson) : {};
        }
        catch {
            extra = {};
        }
        const clienteId = String(extra.clienteId ?? '').trim();
        const consignatarioId = String(extra.consignatarioId ?? '').trim();
        if (!clienteId || !consignatarioId)
            continue;
        const password = (0, crypto_1.decryptString)(a.passwordEnc);
        const existingSession = await (0, excel_store_1.getSession)(a.id);
        const storageState = existingSession ? JSON.parse(existingSession.storageStateJson) : undefined;
        const r = await (0, efectivale_1.scrapeEfectivaleEmpleados)({
            creds: { clienteId, consignatarioId, usuario: a.username, password },
            storageState,
            debug: false,
        });
        const origen = a.alias ? `${a.alias} (${a.username})` : a.username;
        for (const row of r.rows) {
            sheet.addRow({
                cuenta: row.cuenta,
                tarjeta: row.tarjeta,
                empleado: row.empleado,
                usuarioParametros: row.usuarioParametros,
                saldo: row.saldo ?? 0,
                origen,
            });
            total += row.saldo ?? 0;
            empleados++;
        }
        cuentas++;
    }
    const summary = wb.addWorksheet('Resumen');
    summary.columns = [
        { header: 'Métrica', key: 'k', width: 26 },
        { header: 'Valor', key: 'v', width: 18 },
    ];
    summary.getRow(1).font = { bold: true };
    summary.addRow({ k: 'Cuentas Efectivale', v: cuentas });
    summary.addRow({ k: 'Empleados', v: empleados });
    summary.addRow({ k: 'Saldo total', v: total });
    summary.getColumn('v').numFmt = '$#,##0.00';
    const dir = ensureReportsDir();
    const filePath = node_path_1.default.join(dir, `reporte-efectivale-gasolina-${todayStamp()}-1300.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return { filePath, totalSaldo: total, cuentas, empleados };
}
async function maybeEmailReport(filePath, subject = 'Reporte Excel — Control Vehicular') {
    const cfg = getEmailConfig();
    if (!cfg)
        return { emailed: false, reason: 'SMTP no configurado' };
    const transporter = nodemailer_1.default.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
        from: cfg.from,
        to: cfg.to,
        subject,
        text: 'Adjunto reporte en Excel.',
        attachments: [{ filename: node_path_1.default.basename(filePath), path: filePath }],
    });
    return { emailed: true };
}
