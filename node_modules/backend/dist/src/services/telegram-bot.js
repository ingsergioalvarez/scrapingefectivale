"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopTelegramBot = stopTelegramBot;
exports.startTelegramBot = startTelegramBot;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const node_crypto_1 = require("node:crypto");
const excel_store_1 = require("../store/excel-store");
const mysql_telegram_1 = require("../store/mysql-telegram");
const telegram_notify_1 = require("./telegram-notify");
let activeBot = null;
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
/** Evita procesar el mismo message_id dos veces (p. ej. si hubo registro duplicado de listeners). */
const processedTelegramMessageIds = new Set();
function skipIfDuplicateTelegramMessage(msg) {
    const k = `${msg.chat.id}:${msg.message_id}`;
    if (processedTelegramMessageIds.has(k))
        return true;
    processedTelegramMessageIds.add(k);
    if (processedTelegramMessageIds.size > 4000)
        processedTelegramMessageIds.clear();
    return false;
}
/** Detiene getUpdates (evita 409 al reiniciar tsx watch o al cerrar el proceso). */
function stopTelegramBot() {
    try {
        if (activeBot) {
            activeBot.removeAllListeners();
            activeBot.stopPolling({ cancel: true });
        }
    }
    catch {
        // ignore
    }
    activeBot = null;
    (0, telegram_notify_1.unregisterTelegramBotForNotify)();
}
function stripDiacritics(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
/** El bot solo atiende saldo/gasolina/aclaración después de que el usuario escriba "hola" (disparador). */
function isHolaTrigger(text) {
    const t = stripDiacritics(text.trim().toLowerCase());
    if (!t)
        return false;
    const first = t
        .split(/\s+/)[0]
        .replace(/^[¡¿]+/g, '')
        .replace(/[!?.]+$/g, '');
    return first === 'hola';
}
function normalizeCuenta(s) {
    return String(s ?? '')
        .replace(/\s+/g, '')
        .trim();
}
function parseMoney(s) {
    const cleaned = String(s ?? '')
        .replace(/\s/g, '')
        .replace(/[$,]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
function getName(msg) {
    const f = msg.from;
    const parts = [f?.first_name, f?.last_name].filter(Boolean);
    return parts.length ? parts.join(' ') : String(f?.username ?? 'usuario');
}
function slotLabel(slot) {
    return slot === '05' ? '5:00' : slot === '17' ? '17:00' : `corte ${slot}`;
}
async function sendSaldoReply(bot, chatId, hit) {
    const t = hit.scrapedAt;
    const fecha = t.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    const saldoTxt = hit.saldo != null ? `$${hit.saldo.toFixed(2)}` : 'sin dato';
    await bot.sendMessage(chatId, [
        `Hola. Aquí está tu saldo según el último corte guardado en el sistema:`,
        ``,
        `Saldo: **${saldoTxt}**`,
        `Corte: **${slotLabel(hit.slot)}** (registrado: ${fecha})`,
        hit.origenLabel ? `Origen login: ${hit.origenLabel}` : '',
        ``,
        `*Aclaración:* este valor corresponde al scraping automático a las **5:00** y **17:00** (hora del servidor). Entre cortes puede haber movimientos en Efectivale que aquí aún no se reflejan.`,
        ``,
        `Gracias por usar mis servicios.`,
    ]
        .filter(Boolean)
        .join('\n'), { parse_mode: 'Markdown' });
}
const states = new Map();
/** Por chat: hasta escribir "hola" no se procesan menús ni intenciones (solo /start y recordatorio). */
const sessionActivated = new Map();
function isSessionReady(chatId) {
    return sessionActivated.get(chatId) === true;
}
const mainMenuKb = {
    reply_markup: {
        keyboard: [
            [{ text: 'Consultar saldo' }, { text: 'Carga de gasolina' }],
            [{ text: 'Aclaración' }, { text: 'Cancelar' }],
        ],
        resize_keyboard: true,
    },
};
const idTipoKb = {
    reply_markup: {
        keyboard: [[{ text: 'Por número de cuenta' }, { text: 'Por tarjeta (últimos 7)' }], [{ text: 'Cancelar' }]],
        resize_keyboard: true,
    },
};
async function startTelegramBot() {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token)
        return { started: false, reason: 'TELEGRAM_BOT_TOKEN no configurado' };
    if (String(process.env.TELEGRAM_DISABLE_BOT ?? '').toLowerCase() === 'true') {
        return { started: false, reason: 'TELEGRAM_DISABLE_BOT=true (no iniciar bot en esta instancia)' };
    }
    stopTelegramBot();
    // polling: false → registramos handlers, deleteWebhook, pausa (libera 409 con tsx watch) y luego startPolling()
    const bot = new node_telegram_bot_api_1.default(token, { polling: false });
    activeBot = bot;
    (0, telegram_notify_1.registerTelegramBotForNotify)(bot);
    try {
        // La API de Telegram admite `drop_pending_updates`; los tipos de DefinitelyTyped no lo incluyen.
        await bot.deleteWebHook({
            drop_pending_updates: true,
        });
    }
    catch {
        // ignorar
    }
    const delayMs = Math.min(10_000, Math.max(0, Number(process.env.TELEGRAM_POLLING_DELAY_MS ?? 2000) || 2000));
    await sleep(delayMs);
    bot.on('polling_error', (err) => {
        const msg = err?.message ?? String(err);
        // eslint-disable-next-line no-console
        console.error('[telegram] polling_error:', msg);
        if (msg.includes('409') || msg.includes('Conflict')) {
            // eslint-disable-next-line no-console
            console.error('[telegram] 409 Conflict: hay OTRO proceso con el mismo token (otro `npm run dev`, otra PC, o el reinicio de tsx antes de soltar el polling). Cierra duplicados o pon TELEGRAM_DISABLE_BOT=true en la segunda instancia.');
        }
    });
    async function greetAfterHola(chatId) {
        states.set(chatId, { kind: 'idle' });
        sessionActivated.set(chatId, true);
        await bot.sendMessage(chatId, [
            'Listo. Asistente **Control Vehicular**.',
            '',
            'Usa **solo los botones** del menú (saldo, gasolina, aclaración o cancelar).',
        ].join('\n'), { parse_mode: 'Markdown', ...mainMenuKb });
    }
    async function remindMenuIfAlreadyActive(chatId) {
        await bot.sendMessage(chatId, 'El asistente ya está activo. Usa **solo los botones** del menú.', {
            parse_mode: 'Markdown',
            ...mainMenuKb,
        });
    }
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        sessionActivated.set(chatId, false);
        states.set(chatId, { kind: 'idle' });
        await bot.sendMessage(chatId, [
            'Bienvenido a **Control Vehicular** (Telegram).',
            '',
            'Para comenzar, escribe la palabra **hola**.',
            '',
            'Hasta entonces no proceso solicitudes de saldo, gasolina ni aclaraciones.',
        ].join('\n'), { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    });
    bot.onText(/\/cancelar|\/cancel/i, async (msg) => {
        const chatId = msg.chat.id;
        sessionActivated.set(chatId, false);
        states.set(chatId, { kind: 'idle' });
        await bot.sendMessage(chatId, 'Cancelado. Para volver a usar el asistente escribe **hola**.\n\nGracias por usar mis servicios.', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
    });
    bot.on('message', async (msg) => {
        const raw = String(msg.text ?? '').trim();
        if (!raw || raw.startsWith('/'))
            return;
        if (skipIfDuplicateTelegramMessage(msg))
            return;
        const chatId = msg.chat.id;
        const lower = raw.toLowerCase();
        if (lower === 'cancelar' || raw === 'Cancelar') {
            sessionActivated.set(chatId, false);
            states.set(chatId, { kind: 'idle' });
            await bot.sendMessage(chatId, 'Cancelado. Para continuar escribe **hola**.\n\nGracias por usar mis servicios.', {
                parse_mode: 'Markdown',
                reply_markup: { remove_keyboard: true },
            });
            return;
        }
        const st = states.get(chatId) ?? { kind: 'idle' };
        // Disparador "hola": en idle y sin sesión, no se procesa saldo/gasolina/aclaración
        if (st.kind === 'idle' && !isSessionReady(chatId)) {
            if (isHolaTrigger(raw)) {
                await greetAfterHola(chatId);
                return;
            }
            await bot.sendMessage(chatId, 'Para comenzar escribe **hola**. (Así evitamos procesar mensajes por error.)', { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
            return;
        }
        // Menú principal: solo textos del teclado (sin interpretar frases libres)
        if (st.kind === 'idle') {
            if (isHolaTrigger(raw)) {
                await remindMenuIfAlreadyActive(chatId);
                return;
            }
            if (raw === 'Consultar saldo') {
                if (!(0, mysql_telegram_1.mysqlTelegramEnabled)()) {
                    await bot.sendMessage(chatId, 'El consulta de saldos guardados requiere MySQL configurado en el servidor. Contacta al administrador.\n\nGracias por usar mis servicios.');
                    return;
                }
                states.set(chatId, { kind: 'saldo_choose' });
                await bot.sendMessage(chatId, '¿Consultas por **cuenta** o por **tarjeta**?', { parse_mode: 'Markdown', ...idTipoKb });
                return;
            }
            if (raw === 'Carga de gasolina') {
                states.set(chatId, { kind: 'gas_choose' });
                await bot.sendMessage(chatId, 'Para **carga de gasolina**, indica si es por **número de cuenta** o por **tarjeta (últimos 7 dígitos)**.', { parse_mode: 'Markdown', ...idTipoKb });
                return;
            }
            if (raw === 'Aclaración') {
                if (!(0, mysql_telegram_1.mysqlTelegramEnabled)()) {
                    await bot.sendMessage(chatId, 'Las aclaraciones guardadas requieren MySQL. Contacta al administrador.\n\nGracias por usar mis servicios.');
                    return;
                }
                states.set(chatId, { kind: 'acl_comentario' });
                await bot.sendMessage(chatId, 'Escribe tu comentario o aclaración (un solo mensaje).');
                return;
            }
            await bot.sendMessage(chatId, 'Usa **solo los botones** del menú.', { parse_mode: 'Markdown', ...mainMenuKb });
            return;
        }
        // --- Saldo ---
        if (st.kind === 'saldo_choose') {
            if (raw === 'Por número de cuenta') {
                states.set(chatId, { kind: 'saldo_read', mode: 'cuenta' });
                await bot.sendMessage(chatId, 'Indica tu **número de cuenta**.', { parse_mode: 'Markdown' });
                return;
            }
            if (raw === 'Por tarjeta (últimos 7)') {
                states.set(chatId, { kind: 'saldo_read', mode: 'tarjeta' });
                await bot.sendMessage(chatId, 'Indica los **últimos 7 dígitos** de tu tarjeta (solo números).', { parse_mode: 'Markdown' });
                return;
            }
            await bot.sendMessage(chatId, 'Usa solo los botones **Por número de cuenta** o **Por tarjeta (últimos 7)**.', {
                ...idTipoKb,
            });
            return;
        }
        if (st.kind === 'saldo_read') {
            if (!(0, mysql_telegram_1.mysqlTelegramEnabled)()) {
                states.set(chatId, { kind: 'idle' });
                await bot.sendMessage(chatId, 'MySQL no disponible.\n\nGracias por usar mis servicios.');
                return;
            }
            if (st.mode === 'cuenta') {
                const cuenta = normalizeCuenta(raw);
                const hit = await (0, mysql_telegram_1.getLatestSaldoByCuenta)(cuenta);
                states.set(chatId, { kind: 'idle' });
                if (!hit) {
                    await bot.sendMessage(chatId, `No tengo un corte guardado para la cuenta **${cuenta}**. Los saldos se actualizan a las **5:00** y **17:00**.\n\nGracias por usar mis servicios.`, { parse_mode: 'Markdown' });
                    return;
                }
                await sendSaldoReply(bot, chatId, hit);
                return;
            }
            const digits = raw.replace(/\D/g, '').slice(-7);
            if (digits.length !== 7) {
                await bot.sendMessage(chatId, 'Deben ser exactamente 7 dígitos. Intenta de nuevo.');
                return;
            }
            const hit = await (0, mysql_telegram_1.getLatestSaldoByTarjetaUltimos7)(digits);
            states.set(chatId, { kind: 'idle' });
            if (!hit) {
                await bot.sendMessage(chatId, 'No tengo un corte reciente para esa tarjeta. Espera al siguiente corte (5:00 o 17:00) o verifica los dígitos.\n\nGracias por usar mis servicios.');
                return;
            }
            await bot.sendMessage(chatId, `Encontré la cuenta **${hit.cuenta}** para esos dígitos.`, { parse_mode: 'Markdown' });
            await sendSaldoReply(bot, chatId, {
                saldo: hit.saldo,
                scrapedAt: hit.scrapedAt,
                slot: hit.slot,
                origenLabel: hit.origenLabel,
            });
            return;
        }
        // --- Aclaración ---
        if (st.kind === 'acl_comentario') {
            await (0, mysql_telegram_1.insertAclaracion)({
                telegram_chat_id: chatId,
                telegram_user_id: msg.from?.id ?? null,
                solicitante_name: getName(msg),
                comentario: raw,
            });
            states.set(chatId, { kind: 'idle' });
            await bot.sendMessage(chatId, 'Gracias, registré tu aclaración. El equipo la revisará.\n\nGracias por usar mis servicios.', {
                reply_markup: { remove_keyboard: true },
            });
            return;
        }
        // --- Gasolina ---
        if (st.kind === 'gas_choose') {
            if (raw === 'Por número de cuenta') {
                states.set(chatId, { kind: 'gas_read', mode: 'cuenta' });
                await bot.sendMessage(chatId, 'Indica tu **número de cuenta**.', { parse_mode: 'Markdown' });
                return;
            }
            if (raw === 'Por tarjeta (últimos 7)') {
                states.set(chatId, { kind: 'gas_read', mode: 'tarjeta' });
                await bot.sendMessage(chatId, 'Indica los **últimos 7 dígitos** de tu tarjeta.', { parse_mode: 'Markdown' });
                return;
            }
            await bot.sendMessage(chatId, 'Usa solo los botones **Por número de cuenta** o **Por tarjeta (últimos 7)**.', {
                ...idTipoKb,
            });
            return;
        }
        if (st.kind === 'gas_read') {
            if (st.mode === 'cuenta') {
                const cuenta = normalizeCuenta(raw);
                const rules = await (0, excel_store_1.listTopupRules)();
                const rule = rules.find((r) => r.enabled && normalizeCuenta(r.cuenta) === cuenta);
                if (!rule) {
                    states.set(chatId, { kind: 'idle' });
                    await bot.sendMessage(chatId, 'Esa cuenta no está registrada para recargas automáticas. Pide al admin que la agregue en TopupRules.\n\nGracias por usar mis servicios.', { reply_markup: { remove_keyboard: true } });
                    return;
                }
                states.set(chatId, { kind: 'gas_tipo', mode: 'cuenta', cuenta });
            }
            else {
                const digits = raw.replace(/\D/g, '').slice(-7);
                if (digits.length !== 7) {
                    await bot.sendMessage(chatId, 'Deben ser 7 dígitos.');
                    return;
                }
                if ((0, mysql_telegram_1.mysqlTelegramEnabled)()) {
                    const hit = await (0, mysql_telegram_1.getLatestSaldoByTarjetaUltimos7)(digits);
                    if (!hit) {
                        states.set(chatId, { kind: 'idle' });
                        await bot.sendMessage(chatId, 'No encuentro esa tarjeta en el último corte. Espera a 5:00 o 17:00 o verifica los dígitos.\n\nGracias por usar mis servicios.', { reply_markup: { remove_keyboard: true } });
                        return;
                    }
                    const cuentaResolved = normalizeCuenta(hit.cuenta);
                    const rules = await (0, excel_store_1.listTopupRules)();
                    const rule = rules.find((r) => r.enabled && normalizeCuenta(r.cuenta) === cuentaResolved);
                    if (!rule) {
                        states.set(chatId, { kind: 'idle' });
                        await bot.sendMessage(chatId, `La cuenta ${cuentaResolved} no está en TopupRules para recargas.\n\nGracias por usar mis servicios.`, { reply_markup: { remove_keyboard: true } });
                        return;
                    }
                    states.set(chatId, { kind: 'gas_tipo', mode: 'tarjeta', cuenta: cuentaResolved, tarjeta7: digits });
                }
                else {
                    states.set(chatId, { kind: 'idle' });
                    await bot.sendMessage(chatId, 'Consulta por tarjeta requiere MySQL.\n\nGracias por usar mis servicios.', {
                        reply_markup: { remove_keyboard: true },
                    });
                    return;
                }
            }
            await bot.sendMessage(chatId, '¿Tipo de carga?', {
                reply_markup: {
                    keyboard: [[{ text: 'Normal' }, { text: 'Extraordinaria' }], [{ text: 'Cancelar' }]],
                    resize_keyboard: true,
                    one_time_keyboard: true,
                },
            });
            return;
        }
        if (st.kind === 'gas_tipo') {
            let tipo = null;
            if (raw === 'Normal')
                tipo = 'normal';
            else if (raw === 'Extraordinaria')
                tipo = 'extra';
            if (!tipo) {
                await bot.sendMessage(chatId, 'Usa solo los botones **Normal** o **Extraordinaria**.', {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        keyboard: [[{ text: 'Normal' }, { text: 'Extraordinaria' }], [{ text: 'Cancelar' }]],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                });
                return;
            }
            const rules = await (0, excel_store_1.listTopupRules)();
            const cuentaKey = st.mode === 'cuenta' ? st.cuenta : st.cuenta;
            const rule = rules.find((r) => r.enabled && normalizeCuenta(r.cuenta) === normalizeCuenta(cuentaKey));
            let activities = [];
            if (rule?.activitiesJson) {
                try {
                    const arr = JSON.parse(rule.activitiesJson);
                    if (Array.isArray(arr))
                        activities = arr.map((x) => String(x));
                }
                catch {
                    activities = [];
                }
            }
            states.set(chatId, {
                kind: 'gas_act',
                mode: st.mode,
                cuenta: st.cuenta,
                tarjeta7: st.tarjeta7,
                tipo,
            });
            if (activities.length) {
                await bot.sendMessage(chatId, 'Selecciona actividad:', {
                    reply_markup: {
                        keyboard: [...activities.slice(0, 12).map((a) => [{ text: a }]), [{ text: 'Cancelar' }]],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                });
            }
            else {
                await bot.sendMessage(chatId, 'Describe la **actividad** asignada (texto libre).', { parse_mode: 'Markdown' });
            }
            return;
        }
        if (st.kind === 'gas_act') {
            const actividad = raw;
            states.set(chatId, {
                kind: 'gas_monto',
                mode: st.mode,
                cuenta: st.cuenta,
                tarjeta7: st.tarjeta7,
                tipo: st.tipo,
                actividad,
            });
            await bot.sendMessage(chatId, '¿Cuánto necesitas cargar? (ej. `500`)', { parse_mode: 'Markdown' });
            return;
        }
        if (st.kind === 'gas_monto') {
            const monto = parseMoney(raw);
            if (monto == null || monto <= 0) {
                await bot.sendMessage(chatId, 'Monto inválido.');
                return;
            }
            const id = (0, node_crypto_1.randomUUID)();
            const cuentaNorm = st.cuenta ? normalizeCuenta(st.cuenta) : null;
            await (0, mysql_telegram_1.createGasolinaRequest)({
                id,
                telegram_chat_id: chatId,
                telegram_user_id: msg.from?.id ?? null,
                solicitante_name: getName(msg),
                id_tipo: st.mode === 'cuenta' ? 'cuenta' : 'tarjeta',
                cuenta: st.mode === 'cuenta' ? cuentaNorm : cuentaNorm,
                tarjeta_ultimos7: st.mode === 'tarjeta' ? st.tarjeta7 ?? null : null,
                tipo_carga: st.tipo,
                actividad: st.actividad,
                monto,
            });
            states.set(chatId, { kind: 'idle' });
            await bot.sendMessage(chatId, [
                '**Se está validando tu solicitud.** Un administrador la revisará en la aplicación web.',
                '',
                `Resumen: ${st.mode === 'cuenta' ? `Cuenta ${cuentaNorm}` : `Tarjeta …${st.tarjeta7}`} | ${st.tipo} | $${monto.toFixed(2)}`,
                '',
                'Si se autoriza, recibirás un mensaje cuando la carga haya sido dispersada.',
                '',
                'Gracias por usar mis servicios.',
            ].join('\n'), { parse_mode: 'Markdown', reply_markup: { remove_keyboard: true } });
            return;
        }
    });
    bot.startPolling();
    return { started: true };
}
