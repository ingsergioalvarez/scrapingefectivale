"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.efectivaleDispersarCuenta = efectivaleDispersarCuenta;
exports.runFridayTopupsEfectivale = runFridayTopupsEfectivale;
const crypto_1 = require("../crypto");
const excel_store_1 = require("../store/excel-store");
const efectivale_1 = require("../scrapers/efectivale");
const playwright_1 = require("playwright");
const config_1 = require("../config");
function round2(n) {
    return Math.round(n * 100) / 100;
}
async function ensureEfectivaleLoggedAndAtDispersion(page, creds) {
    // Reusamos la lógica existente del scraper de empleados indirectamente:
    // - Abrimos login y llenamos si hace falta
    // - Navegamos al menú "Dispersión Tarjeta Corporativo"
    // Para evitar duplicar (y por ahora sin exportar helpers), hacemos lo mínimo aquí con selectores ya conocidos.
    await page.goto('https://www.efectivale.com.mx/efectinet/login', { waitUntil: 'domcontentloaded' });
    const loginVisible = await page.locator('input[name="clienteID"]').isVisible().catch(() => false);
    if (loginVisible) {
        await page.fill('input[name="clienteID"]', creds.clienteId);
        await page.fill('input[name="consignatarioID"]', creds.consignatarioId);
        await page.fill('input[name="usuarioUSR"]', creds.usuario);
        await page.fill('input[name="usuarioPWD"]', creds.password);
        await Promise.all([page.waitForLoadState('domcontentloaded'), page.click('input[name="Ingresar"]')]);
    }
    // Cerrar modal/banner si estorba (misma técnica que en el scraper).
    await page
        .evaluate(() => {
        const d = globalThis.document;
        const m = d?.querySelector?.('#myModal');
        if (m) {
            m.style.pointerEvents = 'none';
            m.classList?.remove?.('in');
            m.style.display = 'none';
            m.setAttribute?.('aria-hidden', 'true');
        }
        d?.querySelectorAll?.('.modal-backdrop')?.forEach?.((b) => b.remove?.());
        d?.body?.classList?.remove?.('modal-open');
    })
        .catch(() => { });
    // Menú Efectinet -> Administración de Servicios -> Efecticard Corporativo -> Administración Monedero Corporativo -> Dispersión Tarjeta Corporativo
    await page.getByText('Menú Efectinet', { exact: true }).click({ timeout: 20000, force: true });
    await page.getByText('Administración de Servicios', { exact: true }).click({ timeout: 20000, force: true });
    await page.getByText('Efecticard Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    await page.getByText('Administración Monedero Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    await page.getByText('Dispersión Tarjeta Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    await page.waitForTimeout(600);
}
async function efectivaleDispersarCuenta(args) {
    const headless = args.debug ? false : config_1.config.playwrightHeadless;
    const browser = await playwright_1.chromium.launch({ headless });
    const ctx = await browser.newContext(args.storageState ? { storageState: args.storageState } : {});
    try {
        const page = await ctx.newPage();
        await ensureEfectivaleLoggedAndAtDispersion(page, args.creds);
        // Inputs reportados por el usuario:
        // <input name="cuenta" ...> y <input name="montoDispersion" ...>
        await page.fill('input[name="cuenta"]', String(args.cuenta).trim());
        await page.fill('input[name="montoDispersion"]', String(round2(args.monto)));
        // Aceptar 1 (envía formulario y abre nueva página)
        const aceptar = page.locator('input[name="xoAceptar"][value="Aceptar"]').first();
        await Promise.all([page.waitForLoadState('domcontentloaded'), aceptar.click({ timeout: 20000, force: true })]);
        // Aceptar 2 (confirmación)
        const aceptar2 = page.locator('input[name="xoAceptar"][value="Aceptar"]').first();
        await Promise.all([page.waitForLoadState('domcontentloaded'), aceptar2.click({ timeout: 20000, force: true })]);
        const storageState = await ctx.storageState();
        return { storageState };
    }
    finally {
        await browser.close();
    }
}
async function runFridayTopupsEfectivale(opts) {
    const rules = (await (0, excel_store_1.listTopupRules)()).filter((r) => r.enabled);
    if (!rules.length)
        return { ok: true, processed: 0, toppedUp: 0 };
    let processed = 0;
    let toppedUp = 0;
    for (const rule of rules) {
        processed++;
        const account = await (0, excel_store_1.getAccount)(rule.efectivaleAccountId);
        if (!account || account.app !== 'efectivale')
            continue;
        let extra = {};
        try {
            extra = account.extraJson ? JSON.parse(account.extraJson) : {};
        }
        catch {
            extra = {};
        }
        const clienteId = String(extra.clienteId ?? '').trim();
        const consignatarioId = String(extra.consignatarioId ?? '').trim();
        if (!clienteId || !consignatarioId)
            continue;
        const password = (0, crypto_1.decryptString)(account.passwordEnc);
        const sess = await (0, excel_store_1.getSession)(account.id);
        const storageState = sess ? JSON.parse(sess.storageStateJson) : undefined;
        // Consultar saldo actual (scrape completo del listado y filtramos por cuenta)
        const scraped = await (0, efectivale_1.scrapeEfectivaleEmpleados)({
            creds: { clienteId, consignatarioId, usuario: account.username, password },
            storageState,
            debug: !!opts?.debug,
        });
        const row = scraped.rows.find((r) => String(r.cuenta).trim() === String(rule.cuenta).trim());
        const saldo = row?.saldo ?? null;
        if (saldo == null) {
            await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
            continue;
        }
        // Regla: si está por debajo del mínimo, recargamos hasta el máximo.
        const minSaldo = Number(rule.minSaldo ?? 0);
        const maxSaldo = Number(rule.maxSaldo ?? 0);
        if (!(maxSaldo > 0) || !(maxSaldo >= minSaldo)) {
            await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
            continue;
        }
        if (saldo < minSaldo) {
            const monto = round2(maxSaldo - saldo);
            if (monto > 0.01) {
                const d = await efectivaleDispersarCuenta({
                    creds: { clienteId, consignatarioId, usuario: account.username, password },
                    storageState: scraped.storageState,
                    cuenta: rule.cuenta,
                    monto,
                    debug: !!opts?.debug,
                });
                await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(d.storageState));
                toppedUp++;
                continue;
            }
        }
        // Siempre persistir storageState actualizado del scrape
        await (0, excel_store_1.upsertSession)(account.id, JSON.stringify(scraped.storageState));
    }
    return { ok: true, processed, toppedUp };
}
