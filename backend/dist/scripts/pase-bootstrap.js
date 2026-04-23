"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:readline/promises"));
const node_process_1 = require("node:process");
const playwright_1 = require("playwright");
const crypto_1 = require("../src/crypto");
const config_1 = require("../src/config");
const excel_store_1 = require("../src/store/excel-store");
function parseArgs() {
    const out = {};
    for (const a of process.argv.slice(2)) {
        const [k, v] = a.replace(/^--/, '').split('=');
        if (k && v !== undefined)
            out[k] = v;
    }
    return out;
}
async function main() {
    const args = parseArgs();
    const accountId = Number(args.accountId);
    if (!Number.isFinite(accountId)) {
        console.error('Uso: npm run pase:bootstrap -- --accountId=1');
        process.exit(1);
    }
    const acc = await (0, excel_store_1.getAccount)(accountId);
    if (!acc)
        throw new Error('Cuenta no encontrada');
    if (acc.app !== 'pase')
        throw new Error('La cuenta no es de app=pase');
    const username = String(acc.username);
    const password = (0, crypto_1.decryptString)(String(acc.passwordEnc));
    const browser = await playwright_1.chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://apps.pase.com.mx/uc/', { waitUntil: 'domcontentloaded' });
    // Intento de autofill (puede variar por cambios del sitio)
    try {
        const userInput = page.locator('input[type="email"], input[type="text"]').first();
        await userInput.fill(username, { timeout: 5000 });
        const passInput = page.locator('input[type="password"]').first();
        await passInput.fill(password, { timeout: 5000 });
    }
    catch {
        // Si no encuentra inputs, el usuario llenará manualmente.
    }
    console.log('Se abrió el navegador. Inicia sesión en PASE y resuelve el CAPTCHA si aparece.');
    console.log('Cuando ya puedas ver el módulo "Tags", regresa a esta terminal y presiona ENTER.');
    const rl = promises_1.default.createInterface({ input: node_process_1.stdin, output: node_process_1.stdout });
    await rl.question('');
    rl.close();
    const storageState = await context.storageState();
    await (0, excel_store_1.upsertSession)(accountId, JSON.stringify(storageState));
    await browser.close();
    console.log('Sesión guardada en Excel. Ya puedes ejecutar el scraping.');
    console.log(`Tip: PLAYWRIGHT_HEADLESS=${config_1.config.playwrightHeadless ? 'true' : 'false'}`);
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
