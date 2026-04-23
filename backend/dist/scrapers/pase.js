"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapePaseTags = scrapePaseTags;
const playwright_1 = require("playwright");
const config_1 = require("../config");
function parseMoneyToNumber(input) {
    const cleaned = input.replace(/\s/g, '').replace(/[$,]/g, '');
    if (!cleaned)
        return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}
async function gotoTagsAndSetPageSize(ctx) {
    const page = await ctx.newPage();
    await page.goto('https://apps.pase.com.mx/uc/', { waitUntil: 'domcontentloaded' });
    // Si aparece bloqueo/CAPTCHA de Radware, esto fallará (y lo reportamos arriba).
    await page.getByRole('tab', { name: 'Tags' }).click({ timeout: 15000 });
    // Cambiar de 10 a 100 (MUI). Primer intento: role=button name="10".
    const pageSizeButton = (await page.getByRole('button', { name: '10' }).first().isVisible().catch(() => false))
        ? page.getByRole('button', { name: '10' }).first()
        : page.locator('div[role="button"][aria-haspopup="true"]').first();
    await pageSizeButton.click({ timeout: 15000 });
    const option100 = (await page.getByRole('option', { name: '100' }).first().isVisible().catch(() => false))
        ? page.getByRole('option', { name: '100' }).first()
        : page.getByText('100', { exact: true }).first();
    await option100.click({ timeout: 15000 });
    // Esperar a que carguen filas
    await page.waitForTimeout(1000);
    return page;
}
async function scrapePaseTags(storageState) {
    const browser = await playwright_1.chromium.launch({ headless: config_1.config.playwrightHeadless });
    const ctx = await browser.newContext({ storageState });
    try {
        const page = await gotoTagsAndSetPageSize(ctx);
        const rowLocator = page.locator('div:has(a[href^="/uc/detalletag/"])');
        const count = await rowLocator.count();
        const results = [];
        for (let i = 0; i < count; i++) {
            const row = rowLocator.nth(i);
            const tag = (await row.locator('a[href^="/uc/detalletag/"]').first().innerText()).trim();
            const ps = (await row.locator('p').allInnerTexts()).map((t) => t.trim());
            // Heurística basada en la UI actual:
            // [0]=TAG, [1]=No económico / nombre, [2]=placas, [3]=clase, [4]=tipo, [5]=estatus, [6]=saldo
            const noEconomico = ps[1] ? ps[1] : null;
            const placas = ps[2] ? ps[2] : null;
            const clase = ps[3] ? ps[3] : null;
            const tipo = ps[4] ? ps[4] : null;
            const estatus = ps[5] ? ps[5] : null;
            const saldo = ps[6] ? parseMoneyToNumber(ps[6]) : null;
            results.push({ tag, noEconomico, placas, clase, tipo, estatus, saldo });
        }
        return results;
    }
    finally {
        await browser.close();
    }
}
