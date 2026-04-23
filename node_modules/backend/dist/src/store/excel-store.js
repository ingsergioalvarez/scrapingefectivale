"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStorePathForDebug = getStorePathForDebug;
exports.listAccounts = listAccounts;
exports.listTopupRules = listTopupRules;
exports.upsertTopupRule = upsertTopupRule;
exports.deleteTopupRule = deleteTopupRule;
exports.createAccount = createAccount;
exports.updateAccount = updateAccount;
exports.deleteAccount = deleteAccount;
exports.getAccount = getAccount;
exports.getSession = getSession;
exports.upsertSession = upsertSession;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const exceljs_1 = __importDefault(require("exceljs"));
function parseIsoOr0(s) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
}
function normalizeStore(data) {
    // Dedupe accounts by (app, username, extraJson). Keep the most recently updated.
    const byKey = new Map();
    for (const a of data.accounts) {
        const key = `${a.app}|${a.username}|${a.extraJson ?? ''}`;
        const prev = byKey.get(key);
        if (!prev || parseIsoOr0(a.updatedAt) >= parseIsoOr0(prev.updatedAt)) {
            byKey.set(key, a);
        }
    }
    const accounts = Array.from(byKey.values()).filter((a) => a.app === 'efectivale');
    // Ensure unique IDs (if collisions across different keys ever happen)
    const usedIds = new Set();
    let nextId = accounts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
    for (const a of accounts) {
        if (!Number.isFinite(a.id) || usedIds.has(a.id)) {
            a.id = nextId++;
        }
        usedIds.add(a.id);
    }
    // Sessions: keep latest per accountId
    const sessById = new Map();
    for (const s of data.sessions) {
        const prev = sessById.get(s.accountId);
        if (!prev || parseIsoOr0(s.updatedAt) >= parseIsoOr0(prev.updatedAt)) {
            sessById.set(s.accountId, s);
        }
    }
    const sessions = Array.from(sessById.values()).filter((s) => usedIds.has(s.accountId));
    // Topup rules: unique by (efectivaleAccountId, cuenta). Keep most recently updated.
    const ruleByKey = new Map();
    for (const r of data.topupRules ?? []) {
        const key = `${Number(r.efectivaleAccountId)}|${String(r.cuenta ?? '').trim()}`;
        const prev = ruleByKey.get(key);
        if (!prev || parseIsoOr0(r.updatedAt) >= parseIsoOr0(prev.updatedAt))
            ruleByKey.set(key, r);
    }
    const topupRules = Array.from(ruleByKey.values()).filter((r) => r.cuenta && Number.isFinite(r.efectivaleAccountId));
    // Ensure unique IDs inside rules
    const usedRuleIds = new Set();
    let nextRuleId = topupRules.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    for (const r of topupRules) {
        if (!Number.isFinite(r.id) || usedRuleIds.has(r.id))
            r.id = nextRuleId++;
        usedRuleIds.add(r.id);
    }
    return { accounts, sessions, topupRules };
}
function nowIso() {
    return new Date().toISOString();
}
function serverRoot() {
    // .../server/src/store/excel-store.ts -> .../server
    return node_path_1.default.resolve(__dirname, '..', '..');
}
function storePath() {
    return node_path_1.default.join(serverRoot(), 'data', 'store.xlsx');
}
function getStorePathForDebug() {
    return storePath();
}
function ensureDir() {
    node_fs_1.default.mkdirSync(node_path_1.default.dirname(storePath()), { recursive: true });
}
let queue = Promise.resolve(undefined);
async function withLock(fn) {
    let release;
    const next = new Promise((r) => (release = r));
    const prev = queue;
    queue = prev.then(() => next);
    await prev;
    try {
        return await fn();
    }
    finally {
        release();
    }
}
async function loadWorkbook() {
    ensureDir();
    const p = storePath();
    const wb = new exceljs_1.default.Workbook();
    // Migración: antes guardábamos en <repo>/data/store.xlsx por error.
    const legacyPath = node_path_1.default.resolve(serverRoot(), '..', 'data', 'store.xlsx');
    if (!node_fs_1.default.existsSync(p) && node_fs_1.default.existsSync(legacyPath)) {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(p), { recursive: true });
        node_fs_1.default.copyFileSync(legacyPath, p);
    }
    if (node_fs_1.default.existsSync(p)) {
        await wb.xlsx.readFile(p);
        // Migración de columnas: agregar extraJson si falta.
        const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0];
        const headerRow = accountsWs.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value ?? '').trim();
        });
        if (!headers.includes('extraJson')) {
            const nextCol = headers.length + 1;
            headerRow.getCell(nextCol).value = 'extraJson';
            accountsWs.getColumn(nextCol).width = 60;
            headerRow.commit();
            await wb.xlsx.writeFile(p);
        }
        // Migración/creación: TopupRules
        if (!wb.getWorksheet('TopupRules')) {
            const rules = wb.addWorksheet('TopupRules');
            rules.columns = [
                { header: 'id', key: 'id', width: 10 },
                { header: 'efectivaleAccountId', key: 'efectivaleAccountId', width: 18 },
                { header: 'cuenta', key: 'cuenta', width: 14 },
                { header: 'minSaldo', key: 'minSaldo', width: 12 },
                { header: 'maxSaldo', key: 'maxSaldo', width: 12 },
                { header: 'enabled', key: 'enabled', width: 10 },
                { header: 'activitiesJson', key: 'activitiesJson', width: 60 },
                { header: 'notes', key: 'notes', width: 40 },
                { header: 'createdAt', key: 'createdAt', width: 28 },
                { header: 'updatedAt', key: 'updatedAt', width: 28 },
            ];
            await wb.xlsx.writeFile(p);
        }
        return wb;
    }
    wb.creator = 'Control Vehicular';
    wb.created = new Date();
    const accounts = wb.addWorksheet('Accounts');
    accounts.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'app', key: 'app', width: 15 },
        { header: 'alias', key: 'alias', width: 25 },
        { header: 'username', key: 'username', width: 30 },
        { header: 'passwordEnc', key: 'passwordEnc', width: 60 },
        { header: 'extraJson', key: 'extraJson', width: 60 },
        { header: 'notes', key: 'notes', width: 40 },
        { header: 'createdAt', key: 'createdAt', width: 28 },
        { header: 'updatedAt', key: 'updatedAt', width: 28 },
    ];
    const sessions = wb.addWorksheet('Sessions');
    sessions.columns = [
        { header: 'accountId', key: 'accountId', width: 12 },
        { header: 'storageStateJson', key: 'storageStateJson', width: 90 },
        { header: 'updatedAt', key: 'updatedAt', width: 28 },
    ];
    const topupRules = wb.addWorksheet('TopupRules');
    topupRules.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'efectivaleAccountId', key: 'efectivaleAccountId', width: 18 },
        { header: 'cuenta', key: 'cuenta', width: 14 },
        { header: 'minSaldo', key: 'minSaldo', width: 12 },
        { header: 'maxSaldo', key: 'maxSaldo', width: 12 },
        { header: 'enabled', key: 'enabled', width: 10 },
        { header: 'activitiesJson', key: 'activitiesJson', width: 60 },
        { header: 'notes', key: 'notes', width: 40 },
        { header: 'createdAt', key: 'createdAt', width: 28 },
        { header: 'updatedAt', key: 'updatedAt', width: 28 },
    ];
    await wb.xlsx.writeFile(p);
    return wb;
}
function sheetToJson(ws) {
    const out = [];
    const headerRow = ws.getRow(1);
    const keys = [];
    headerRow.eachCell((cell, colNumber) => {
        keys[colNumber - 1] = String(cell.value ?? '').trim();
    });
    for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj = {};
        let hasAny = false;
        keys.forEach((k, idx) => {
            const v = row.getCell(idx + 1).value;
            if (v !== null && v !== undefined && v !== '')
                hasAny = true;
            obj[k] = typeof v === 'object' && v && 'text' in v ? v.text : v;
        });
        if (hasAny)
            out.push(obj);
    }
    return out;
}
function replaceSheet(ws, rows) {
    // borrar todo excepto header
    if (ws.rowCount > 1)
        ws.spliceRows(2, ws.rowCount - 1);
    const headerRow = ws.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '').trim();
    });
    for (const r of rows) {
        const values = headers.map((h) => (h ? (r[h] ?? null) : null));
        ws.addRow(values);
    }
}
async function readStoreUnlocked() {
    const wb = await loadWorkbook();
    const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0];
    const sessionsWs = wb.getWorksheet('Sessions') ?? wb.worksheets[1];
    const rulesWs = wb.getWorksheet('TopupRules');
    const accountsRaw = sheetToJson(accountsWs)
        .map((a) => ({
        id: Number(a.id),
        app: a.app,
        alias: a.alias ?? null,
        username: String(a.username ?? ''),
        passwordEnc: String(a.passwordEnc ?? ''),
        extraJson: a.extraJson ? String(a.extraJson) : null,
        notes: a.notes ?? null,
        createdAt: String(a.createdAt ?? ''),
        updatedAt: String(a.updatedAt ?? ''),
    }))
        .filter((a) => String(a.app).toLowerCase() === 'efectivale');
    const sessionsRaw = sheetToJson(sessionsWs).map((s) => ({
        accountId: Number(s.accountId),
        storageStateJson: String(s.storageStateJson ?? ''),
        updatedAt: String(s.updatedAt ?? ''),
    }));
    const rulesRaw = rulesWs
        ? sheetToJson(rulesWs).map((r) => ({
            id: Number(r.id),
            efectivaleAccountId: Number(r.efectivaleAccountId),
            cuenta: String(r.cuenta ?? '').trim(),
            minSaldo: Number(r.minSaldo ?? 0),
            maxSaldo: Number(r.maxSaldo ?? 0),
            enabled: String(r.enabled ?? 'true').toLowerCase() !== 'false' && Number(r.enabled ?? 1) !== 0,
            activitiesJson: r.activitiesJson ? String(r.activitiesJson) : null,
            notes: r.notes ?? null,
            createdAt: String(r.createdAt ?? ''),
            updatedAt: String(r.updatedAt ?? ''),
        }))
        : [];
    const normalized = normalizeStore({
        accounts: accountsRaw.filter((a) => Number.isFinite(a.id)),
        sessions: sessionsRaw.filter((s) => Number.isFinite(s.accountId)),
        topupRules: rulesRaw.filter((r) => Number.isFinite(r.efectivaleAccountId) && !!r.cuenta),
    });
    return normalized;
}
async function writeStoreUnlocked(data) {
    const normalized = normalizeStore(data);
    const wb = await loadWorkbook();
    const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0];
    const sessionsWs = wb.getWorksheet('Sessions') ?? wb.worksheets[1];
    const rulesWs = wb.getWorksheet('TopupRules');
    replaceSheet(accountsWs, normalized.accounts);
    replaceSheet(sessionsWs, normalized.sessions);
    if (rulesWs)
        replaceSheet(rulesWs, normalized.topupRules);
    await wb.xlsx.writeFile(storePath());
}
async function listAccounts() {
    return withLock(async () => {
        const { accounts, sessions } = await readStoreUnlocked();
        const sessionSet = new Set(sessions.map((s) => s.accountId));
        return accounts
            .slice()
            .sort((a, b) => b.id - a.id)
            .map((a) => ({ ...a, hasSession: sessionSet.has(a.id) }));
    });
}
async function listTopupRules() {
    return withLock(async () => {
        const { topupRules } = await readStoreUnlocked();
        return topupRules.slice().sort((a, b) => b.id - a.id);
    });
}
async function upsertTopupRule(input) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        const t = nowIso();
        const key = `${Number(input.efectivaleAccountId)}|${String(input.cuenta ?? '').trim()}`;
        const existing = input.id != null ? store.topupRules.find((r) => r.id === input.id) : store.topupRules.find((r) => `${r.efectivaleAccountId}|${r.cuenta}` === key);
        if (existing) {
            existing.efectivaleAccountId = Number(input.efectivaleAccountId);
            existing.cuenta = String(input.cuenta ?? '').trim();
            existing.minSaldo = Number(input.minSaldo ?? 0);
            existing.maxSaldo = Number(input.maxSaldo ?? 0);
            existing.enabled = !!input.enabled;
            existing.activitiesJson = input.activitiesJson ?? null;
            existing.notes = input.notes ?? null;
            existing.updatedAt = t;
            await writeStoreUnlocked(store);
            return existing.id;
        }
        const nextId = store.topupRules.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        store.topupRules.push({
            id: nextId,
            efectivaleAccountId: Number(input.efectivaleAccountId),
            cuenta: String(input.cuenta ?? '').trim(),
            minSaldo: Number(input.minSaldo ?? 0),
            maxSaldo: Number(input.maxSaldo ?? 0),
            enabled: !!input.enabled,
            activitiesJson: input.activitiesJson ?? null,
            notes: input.notes ?? null,
            createdAt: t,
            updatedAt: t,
        });
        await writeStoreUnlocked(store);
        return nextId;
    });
}
async function deleteTopupRule(id) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        store.topupRules = store.topupRules.filter((r) => r.id !== id);
        await writeStoreUnlocked(store);
    });
}
async function createAccount(input) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        const t = nowIso();
        // Evitar duplicados: si ya existe (app+username+extraJson) actualizamos password/alias/notes.
        const key = `${input.app}|${input.username}|${input.extraJson ?? ''}`;
        const existing = store.accounts.find((a) => `${a.app}|${a.username}|${a.extraJson ?? ''}` === key);
        if (existing) {
            existing.alias = input.alias;
            existing.passwordEnc = input.passwordEnc;
            existing.notes = input.notes;
            existing.updatedAt = t;
            await writeStoreUnlocked(store);
            return existing.id;
        }
        const nextId = store.accounts.reduce((m, a) => Math.max(m, a.id), 0) + 1;
        store.accounts.push({ id: nextId, ...input, createdAt: t, updatedAt: t });
        await writeStoreUnlocked(store);
        return nextId;
    });
}
async function updateAccount(id, patch) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        const idx = store.accounts.findIndex((a) => a.id === id);
        if (idx < 0)
            return false;
        store.accounts[idx] = { ...store.accounts[idx], ...patch, updatedAt: nowIso() };
        await writeStoreUnlocked(store);
        return true;
    });
}
async function deleteAccount(id) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        store.accounts = store.accounts.filter((a) => a.id !== id);
        store.sessions = store.sessions.filter((s) => s.accountId !== id);
        await writeStoreUnlocked(store);
    });
}
async function getAccount(id) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        return store.accounts.find((a) => a.id === id) ?? null;
    });
}
async function getSession(accountId) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        return store.sessions.find((s) => s.accountId === accountId) ?? null;
    });
}
async function upsertSession(accountId, storageStateJson) {
    return withLock(async () => {
        const store = await readStoreUnlocked();
        const t = nowIso();
        const idx = store.sessions.findIndex((s) => s.accountId === accountId);
        if (idx >= 0)
            store.sessions[idx] = { accountId, storageStateJson, updatedAt: t };
        else
            store.sessions.push({ accountId, storageStateJson, updatedAt: t });
        await writeStoreUnlocked(store);
    });
}
