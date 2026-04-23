"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeEfectivaleEmpleados = scrapeEfectivaleEmpleados;
const playwright_1 = require("playwright");
const config_1 = require("../config");
function parseMoneyToNumber(input) {
    const cleaned = input.replace(/\s/g, '').replace(/[$,]/g, '');
    if (!cleaned)
        return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}
async function closeModalIfPresent(page) {
    // Cierra modales/banners típicos (bootstrap) y overlays.
    const candidates = [
        'button.close',
        'button[data-dismiss="modal"]',
        'button[aria-label="Close"]',
        'button:has(i.fas.fa-times)',
        'button:has-text("Cerrar")',
        'button:has-text("Aceptar")',
        'button:has-text("Entendido")',
        '.modal-dialog button.close',
        '.modal-dialog button[aria-label="Close"]',
    ];
    for (let attempt = 0; attempt < 5; attempt++) {
        let closedAny = false;
        // Caso específico observado: #myModal intercepta clicks.
        const myModal = page.locator('#myModal').first();
        if (await myModal.isVisible().catch(() => false)) {
            // Forzar a que el modal no intercepte clicks mientras lo cerramos.
            await page
                .evaluate(() => {
                const d = globalThis.document;
                const m = d?.querySelector?.('#myModal');
                if (m)
                    m.style.pointerEvents = 'none';
                d?.querySelectorAll?.('.modal-backdrop')?.forEach?.((b) => (b.style.pointerEvents = 'none'));
            })
                .catch(() => { });
            // Intentar cerrar desde el modal
            const closeInside = myModal.locator(candidates.join(',')).first();
            if (await closeInside.isVisible().catch(() => false)) {
                await closeInside.click({ timeout: 2000 }).catch(() => { });
                closedAny = true;
                await page.waitForTimeout(250);
            }
            else {
                // Intentar ESC
                await page.keyboard.press('Escape').catch(() => { });
                await page.waitForTimeout(250);
            }
            // Si aún visible, forzar ocultamiento del modal/backdrop
            if (await myModal.isVisible().catch(() => false)) {
                await page
                    .evaluate(() => {
                    const d = globalThis.document;
                    if (!d)
                        return;
                    const m = d.querySelector('#myModal');
                    if (m) {
                        m.classList.remove('in');
                        m.style.display = 'none';
                        m.setAttribute('aria-hidden', 'true');
                    }
                    d.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
                    d.body?.classList?.remove('modal-open');
                })
                    .catch(() => { });
                closedAny = true;
                await page.waitForTimeout(250);
            }
        }
        for (const sel of candidates) {
            const btn = page.locator(sel).first();
            if (await btn.isVisible().catch(() => false)) {
                await btn.click({ timeout: 2000 }).catch(() => { });
                closedAny = true;
                await page.waitForTimeout(250);
            }
        }
        if (!closedAny)
            break;
    }
}
async function ensureLoggedIn(page, creds, log) {
    log('Ir a login');
    await page.goto('https://www.efectivale.com.mx/efectinet/login', { waitUntil: 'domcontentloaded' });
    const loginVisible = await page.locator('input[name="clienteID"]').isVisible().catch(() => false);
    if (!loginVisible) {
        log('Login form no visible (asumiendo sesión activa)');
        return;
    }
    log('Llenar campos de login');
    await page.fill('input[name="clienteID"]', creds.clienteId);
    await page.fill('input[name="consignatarioID"]', creds.consignatarioId);
    await page.fill('input[name="usuarioUSR"]', creds.usuario);
    await page.fill('input[name="usuarioPWD"]', creds.password);
    log('Click Ingresar');
    await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        page.click('input[name="Ingresar"]'),
    ]);
    log('Cerrar modal si aparece');
    await closeModalIfPresent(page);
    await closeModalIfPresent(page);
}
async function gotoDisperisonTarjeta(page, log) {
    // Menú Efectinet -> Administración de Servicios -> Efecticard Corporativo ->
    // Administración Monedero Corporativo -> Dispersión Tarjeta Corporativo
    // La UI es por divs con onclick; usar texto es más robusto.
    log('Abrir menú: Menú Efectinet');
    await closeModalIfPresent(page);
    await page.getByText('Menú Efectinet', { exact: true }).click({ timeout: 20000, force: true });
    log('Click: Administración de Servicios');
    await closeModalIfPresent(page);
    await page.getByText('Administración de Servicios', { exact: true }).click({ timeout: 20000, force: true });
    log('Click: Efecticard Corporativo');
    await closeModalIfPresent(page);
    await page.getByText('Efecticard Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    log('Click: Administración Monedero Corporativo');
    await closeModalIfPresent(page);
    await page.getByText('Administración Monedero Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    log('Click: Dispersión Tarjeta Corporativo');
    await closeModalIfPresent(page);
    await page.getByText('Dispersión Tarjeta Corporativo', { exact: true }).click({ timeout: 20000, force: true });
    await page.waitForTimeout(700);
}
function extractEmpleadosFromTable(htmlTexts) {
    const out = [];
    for (const tds of htmlTexts) {
        // layout: [radio, Cuenta, Tarjeta, Empleado, Usuario Parametros, Saldo]
        if (tds.length < 6)
            continue;
        const cuenta = tds[1]?.trim() ?? '';
        const tarjeta = tds[2]?.trim() ?? '';
        const empleado = tds[3]?.trim() ?? '';
        const usuarioParametros = tds[4]?.trim() ?? '';
        const saldo = parseMoneyToNumber(tds[5] ?? '');
        if (cuenta)
            out.push({ cuenta, tarjeta, empleado, usuarioParametros, saldo });
    }
    return out;
}
async function readCurrentPageRows(page) {
    // Usar textContent para no perder valores cuando hay spans/nbsp.
    const texts = await page.$$eval('table.DT tr.DF1, table.DT tr.DF2', (trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (String(td.textContent ?? '')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())));
    // Algunas variantes agregan columnas; usamos el último TD como saldo.
    const normalized = texts.map((tds) => {
        if (tds.length < 6)
            return tds;
        const saldo = tds[tds.length - 1];
        const base = tds.slice(0, 5);
        return [...base, saldo];
    });
    return extractEmpleadosFromTable(normalized);
}
async function getPagerText(page) {
    const pager = page.locator('td.IFT').first();
    return (await pager.innerText().catch(() => '')).trim();
}
async function scrapeEfectivaleEmpleados(args) {
    const logs = [];
    const log = (m) => {
        const line = `[efectivale] ${new Date().toISOString()} ${m}`;
        logs.push(line);
        args.log?.(line);
    };
    const headless = args.debug || process.env.EFECTIVALE_DEBUG_HEADFUL === 'true' ? false : config_1.config.playwrightHeadless;
    const slowMo = Number(process.env.EFECTIVALE_SLOWMO_MS ?? 0) || 0;
    const browser = await playwright_1.chromium.launch({ headless, slowMo });
    const ctx = await browser.newContext(args.storageState ? { storageState: args.storageState } : {});
    try {
        const page = await ctx.newPage();
        let step = 'login';
        try {
            await ensureLoggedIn(page, args.creds, log);
            step = 'menu';
            await gotoDisperisonTarjeta(page, log);
            step = 'table';
        }
        catch (e) {
            throw new Error(`Fallo en paso "${step}": ${e?.message ?? String(e)}`);
        }
        const all = [];
        const seen = new Set();
        let lastPager = '';
        for (let guard = 0; guard < 60; guard++) {
            log(`Leer página ${guard + 1}`);
            const pager = await getPagerText(page);
            if (pager && pager === lastPager)
                break;
            lastPager = pager;
            const rows = await readCurrentPageRows(page);
            for (const r of rows) {
                const key = `${r.cuenta}-${r.tarjeta}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    all.push(r);
                }
            }
            const nextBtn = page.locator('input[name="xoSiguiente"]').first();
            const canNext = await nextBtn.isVisible().catch(() => false);
            if (!canNext)
                break;
            log('Click: Siguiente');
            await Promise.all([
                page.waitForLoadState('domcontentloaded'),
                nextBtn.click(),
            ]);
            await page.waitForTimeout(400);
        }
        const storageState = await ctx.storageState();
        log(`OK. Filas totales: ${all.length}`);
        return { rows: all, storageState, logs };
    }
    finally {
        await browser.close();
    }
}
