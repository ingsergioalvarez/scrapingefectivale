import TelegramBot, { type Message } from 'node-telegram-bot-api'
import { config } from '../config'
import { randomUUID } from 'node:crypto'
import {
  listTopupRulesMySql,
  createGasolinaRequest,
  getLatestSaldoByCuenta,
  getLatestSaldoByTarjetaUltimos7,
  insertAclaracion,
  mysqlEnabled,
  getTelegramSession,
  upsertTelegramSession,
  deleteTelegramSession,
  updateSingleSaldo,
  getGasolinaRequest,
  updateGasolinaRequest,
  getLatestSaldoByShortCode
} from '../store/mysql-store'
import { getSaldoInfoForRequest, runSingleTopupRequest } from './telegram-helpers'
import { notifyTelegramUser, registerTelegramBotForNotify, unregisterTelegramBotForNotify } from './telegram-notify'

let activeBot: TelegramBot | null = null

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

const processedTelegramMessageIds = new Set<string>()
function skipIfDuplicateTelegramMessage(msg: Message): boolean {
  const k = `${msg.chat.id}:${msg.message_id}`
  if (processedTelegramMessageIds.has(k)) return true
  processedTelegramMessageIds.add(k)
  if (processedTelegramMessageIds.size > 4000) processedTelegramMessageIds.clear()
  return false
}

export function stopTelegramBot() {
  try {
    if (activeBot) {
      activeBot.removeAllListeners()
      activeBot.stopPolling({ cancel: true } as any)
    }
  } catch {
    // ignore
  }
  activeBot = null
  unregisterTelegramBotForNotify()
}

function stripDiacritics(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function isHolaTrigger(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === '/hola'
}

function normalizeCuenta(s: string) {
  return String(s ?? '').replace(/\s+/g, '').trim()
}

function getName(msg: Message) {
  const f = msg.from
  const parts = [f?.first_name, f?.last_name].filter(Boolean)
  return parts.length ? parts.join(' ') : String(f?.username ?? 'usuario')
}

function slotLabel(slot: string) {
  return slot === '05' ? '5:00' : slot === '17' ? '17:00' : `corte ${slot}`
}



type Step =
  | { kind: 'idle' }
  | { kind: 'saldo_choose' }
  | { kind: 'saldo_read'; mode: 'cuenta' | 'tarjeta' }
  | { kind: 'gas_choose' }
  | { kind: 'gas_read'; mode: 'cuenta' | 'tarjeta' }
  | { kind: 'gas_tipo'; mode: 'cuenta' | 'tarjeta'; cuenta?: string; tarjeta7?: string }
  | { kind: 'gas_act'; mode: 'cuenta' | 'tarjeta'; cuenta?: string; tarjeta7?: string; tipo: 'normal' | 'extra' }
  | { kind: 'acl_comentario' }

const sessionActivated = new Map<number, boolean>()

function isSessionReady(chatId: number) {
  // Para simplificar, consideramos sesion ready si hay un estado en DB 
  // o si el map en memoria dice que sí (para compatibilidad inmediata)
  return sessionActivated.get(chatId) === true
}

const mainMenuKb = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: '📊 Consultar saldo', callback_data: 'menu_saldo' },
        { text: '⛽ Solicitar gasolina', callback_data: 'menu_gas' },
      ],
      [
        { text: '❓ Otros / Aclaración', callback_data: 'menu_otros' },
        { text: '❌ Cancelar', callback_data: 'menu_cancel' },
      ],
    ],
  },
}

const idTipoKb = (prefix: string) => ({
  reply_markup: {
    inline_keyboard: [
      [
        { text: '🔢 Por número de cuenta', callback_data: `${prefix}_cuenta` },
        { text: '💳 Por tarjeta (7 dígitos)', callback_data: `${prefix}_tarjeta` },
        { text: '⚡ Por código corto (1-999)', callback_data: `${prefix}_short` },
      ],
      [{ text: '⬅️ Volver', callback_data: 'menu_back' }],
    ],
  },
})

export async function startTelegramBot(): Promise<{ started: true } | { started: false; reason: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) return { started: false as const, reason: 'TELEGRAM_BOT_TOKEN no configurado' }

  if (String(process.env.TELEGRAM_DISABLE_BOT ?? '').toLowerCase() === 'true') {
    return { started: false as const, reason: 'TELEGRAM_DISABLE_BOT=true' }
  }

  stopTelegramBot()
  const bot = new TelegramBot(token, { polling: false })
  activeBot = bot
  registerTelegramBotForNotify(bot)

  try {
    await (bot as any).deleteWebHook({ drop_pending_updates: true })
  } catch { /* ignore */ }
  
  await sleep(2000)

  bot.on('polling_error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[telegram] polling_error:', err.message)
  })

  async function greetAfterHola(chatId: number) {
    await upsertTelegramSession(chatId, { kind: 'idle' })
    sessionActivated.set(chatId, true)
    await bot.sendMessage(chatId, 'Listo. Asistente **Control Vehicular**.\nUsa los botones del menú.', { parse_mode: 'Markdown', ...mainMenuKb })
  }

  bot.onText(/\/hola/i, async (msg: Message) => {
    const chatId = msg.chat.id
    if (isSessionReady(chatId)) {
      await bot.sendMessage(chatId, 'El asistente ya está activo. Selecciona una opción del menú:', { parse_mode: 'Markdown', ...mainMenuKb })
    } else {
      await greetAfterHola(chatId)
    }
  })

  async function finalizeGasolineRequest(chatId: number, user: any, solicitanteName: string, state: any, actividad: string) {
    const info = await getSaldoInfoForRequest({ cuenta: state.cuenta, tarjetaUltimos7: state.tarjeta7 })
    if (!info) {
      await bot.sendMessage(chatId, 'Error interno: no se pudo recuperar la info de recarga.')
      return
    }

    const id = randomUUID()
    const montoCalculado = Math.max(0, info.maxSaldo - (info.saldo ?? 0))

    await createGasolinaRequest({
      id,
      telegram_chat_id: chatId,
      telegram_user_id: user?.id ?? null,
      solicitante_name: solicitanteName,
      id_tipo: state.mode === 'cuenta' ? 'cuenta' : 'tarjeta',
      cuenta: state.cuenta || null,
      tarjeta_ultimos7: state.tarjeta7 || null,
      tipo_carga: state.tipo,
      actividad,
      monto: montoCalculado,
      saldo_actual_scraped: info.saldo,
      max_saldo_regla: info.maxSaldo,
      status: 'pending'
    })

    await upsertTelegramSession(chatId, { kind: 'idle' })
    await bot.sendMessage(chatId, '✅ **Solicitud enviada.**\n⏳ Tu petición se encuentra en **proceso de validación** por el administrador. Te notificaremos en cuanto se realice la dispersión.', { parse_mode: 'Markdown' })

    const adminChatIds = config.telegramAdminChatIds
    for (const adminChatId of adminChatIds) {
      try {
        await bot.sendMessage(adminChatId, [
          `🔔 **Nueva Solicitud de Gasolina**`,
          `👤 **Empleado**: ${solicitanteName}`,
          `🆔 **ID**: ${state.cuenta || state.tarjeta7}`,
          `💵 **Saldo Actual**: $${(info.saldo ?? 0).toFixed(2)}`,
          `💰 **Monto sugerido**: $${montoCalculado.toFixed(2)}`,
          `📝 **Actividad**: ${actividad}`
        ].join('\n'), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: `✅ Aprobar $${montoCalculado.toFixed(2)}`, callback_data: `admin_appr_${id}` },
              { text: '❌ Rechazar', callback_data: `admin_rejc_${id}` }
            ]]
          }
        })
      } catch (err) {
        console.error(`[telegram] error notificando a admin ${adminChatId}:`, err)
      }
    }
  }

  bot.onText(/\/miid/, async (msg) => {
    await bot.sendMessage(msg.chat.id, `Tu ID de chat es: \`${msg.chat.id}\``, { parse_mode: 'Markdown' })
  })

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id
    sessionActivated.set(chatId, false)
    await upsertTelegramSession(chatId, { kind: 'idle' })
    await bot.sendMessage(chatId, 'Bienvenido. Escribe **/hola** para comenzar.', { parse_mode: 'Markdown' })
  })

  bot.on('message', async (msg) => {
    try {
      const raw = String(msg.text ?? '').trim()
      if (!raw) return
      if (raw.startsWith('/') && !isHolaTrigger(raw)) return
      if (skipIfDuplicateTelegramMessage(msg)) return

      const chatId = msg.chat.id
      const st = (await getTelegramSession(chatId)) ?? { kind: 'idle' }
      
      // eslint-disable-next-line no-console
      console.log(`[telegram] msg de ${getName(msg)} (state=${st.kind}): "${raw}"`)

      if (st.kind === 'idle' && !isSessionReady(chatId)) {
        await bot.sendMessage(chatId, 'Escribe **/hola** para comenzar.')
        return
      }

      if (st.kind === 'idle') {
        await bot.sendMessage(chatId, 'Usa los botones del menú.', mainMenuKb)
        return
      }

      if (st.kind === 'saldo_read') {
        const val = parseInt(raw, 10)
        let hit = null
        let query = raw

        if (!isNaN(val) && val > 0 && val < 1000) {
          hit = await getLatestSaldoByShortCode(val)
        } else {
          query = st.mode === 'cuenta' ? normalizeCuenta(raw) : raw.replace(/\D/g, '').slice(-7)
          hit = st.mode === 'cuenta' 
            ? await getLatestSaldoByCuenta(query)
            : await getLatestSaldoByTarjetaUltimos7(query)
        }
        
        await upsertTelegramSession(chatId, { kind: 'idle' })
        if (!hit) {
          await bot.sendMessage(chatId, '❌ No se encontró información reciente para esa cuenta/tarjeta/código.')
        } else {
          await sendSaldoReply(chatId, hit, query)
        }
        return
      }

      if (st.kind === 'acl_comentario') {
        await insertAclaracion({
          telegram_chat_id: chatId,
          telegram_user_id: msg.from?.id ?? null,
          solicitante_name: getName(msg),
          comentario: raw
        })
        await upsertTelegramSession(chatId, { kind: 'idle' })
        await bot.sendMessage(chatId, '✅ Registrado. El equipo lo revisará.')
        return
      }

      if (st.kind === 'gas_read') {
        const val = parseInt(raw, 10)
        let resolved = null

        if (!isNaN(val) && val > 0 && val < 1000) {
           resolved = (await getLatestSaldoByShortCode(val))?.cuenta
        } else {
          const query = st.mode === 'cuenta' ? normalizeCuenta(raw) : raw.replace(/\D/g, '').slice(-7)
          resolved = st.mode === 'cuenta' ? query : (await getLatestSaldoByTarjetaUltimos7(query))?.cuenta
        }
        
        if (!resolved) {
          await bot.sendMessage(chatId, '❌ No se pudo identificar la cuenta vinculada.')
          await upsertTelegramSession(chatId, { kind: 'idle' })
          return
        }

        await bot.sendMessage(chatId, '🔍 Consultando saldo actual...')
        try {
          const info = await getSaldoInfoForRequest({ cuenta: resolved })
          if (!info) throw new Error('No se encontró info')
          
          await upsertTelegramSession(chatId, { kind: 'gas_tipo', mode: st.mode, cuenta: resolved })
          await bot.sendMessage(chatId, `Saldo: $${(info.saldo ?? 0).toFixed(2)}\nMonto sugerido: $${(info.maxSaldo - (info.saldo ?? 0)).toFixed(2)}\n\n¿Tipo de carga?`, {
            reply_markup: {
              inline_keyboard: [[
                { text: '🟢 Normal', callback_data: 'gas_set_tipo_normal' },
                { text: '🟡 Extra', callback_data: 'gas_set_tipo_extra' }
              ]]
            }
          })
        } catch (e: any) {
          console.error('[telegram] error en consulta de gas:', e)
          await bot.sendMessage(chatId, `❌ Error al consultar saldo: ${e.message}`)
          await upsertTelegramSession(chatId, { kind: 'idle' })
        }
        return
      }

      if (st.kind === 'gas_act') {
        await finalizeGasolineRequest(chatId, msg.from, getName(msg), st, raw)
        return
      }
    } catch (err: any) {
      console.error('[telegram] error en on(message):', err)
      const chatId = msg.chat.id
      await bot.sendMessage(chatId, `⚠️ Ocurrió un error interno: ${err.message}`)
    }
  })

  bot.on('callback_query', async (query) => {
    try {
      const chatId = query.message?.chat.id
      if (!chatId) return
      const data = query.data || ''
      const msgId = query.message?.message_id

      await bot.answerCallbackQuery(query.id)
      
      // eslint-disable-next-line no-console
      console.log(`[telegram] callback de ${query.from.first_name}: "${data}"`)

      if (data === 'menu_saldo') {
        await upsertTelegramSession(chatId, { kind: 'saldo_choose' })
        await bot.editMessageText('¿Consultas por cuenta o tarjeta?', { chat_id: chatId, message_id: msgId, ...idTipoKb('saldo') })
      } else if (data === 'menu_gas') {
        await upsertTelegramSession(chatId, { kind: 'gas_choose' })
        await bot.editMessageText('¿Solicitas por cuenta o tarjeta?', { chat_id: chatId, message_id: msgId, ...idTipoKb('gas') })
      } else if (data === 'menu_cancel' || data === 'menu_back') {
        await upsertTelegramSession(chatId, { kind: 'idle' })
        await bot.editMessageText('Selecciona opción:', { chat_id: chatId, message_id: msgId, ...mainMenuKb })
      } else if (data.endsWith('_cuenta') || data.endsWith('_tarjeta') || data.endsWith('_short')) {
        const parts = data.split('_')
        const kind = parts[0] === 'saldo' ? 'saldo_read' : 'gas_read'
        const mode = parts[1] as 'cuenta' | 'tarjeta' | 'short'
        
        await upsertTelegramSession(chatId, { kind, mode })
        let prompt = ''
        if (mode === 'cuenta') prompt = 'Escribe el número de CUENTA:'
        else if (mode === 'tarjeta') prompt = 'Escribe los últimos 7 dígitos de la TARJETA:'
        else prompt = 'Escribe el CÓDIGO CORTO (1-999):'
        
        await bot.sendMessage(chatId, prompt)
      } else if (data.startsWith('gas_set_tipo_')) {
        const tipo = data.includes('normal') ? 'normal' : 'extra'
        const st = await getTelegramSession(chatId)
        if (st?.kind === 'gas_tipo') {
          await upsertTelegramSession(chatId, { ...st, kind: 'gas_act', tipo })
          await bot.editMessageText('Describe la **actividad** (un solo mensaje):', { chat_id: chatId, message_id: msgId, parse_mode: 'Markdown' })
        }
      } else if (data.startsWith('admin_appr_') || data.startsWith('admin_rejc_')) {
      const isApprove = data.startsWith('admin_appr_')
      const requestId = data.replace(isApprove ? 'admin_appr_' : 'admin_rejc_', '')
      
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId })
      
      if (isApprove) {
        await bot.sendMessage(chatId, '⏳ Procesando...')
        try {
          const row = await getGasolinaRequest(requestId)
          if (!row) throw new Error('No existe')

          if (row.status !== 'pending') {
            await bot.sendMessage(chatId, `⚠️ **Ya procesada**\n\nEsta solicitud ya fue atendida por otro administrador (Estado: ${row.status}).`)
            return
          }

          const res = await runSingleTopupRequest({ cuenta: row.cuenta || undefined, tarjetaUltimos7: row.tarjeta_ultimos7 || undefined, requestedMonto: row.monto })
          await updateGasolinaRequest(row.id, { 
            status: 'dispersed',
            admin_approver_id: query.from.id,
            admin_approver_name: getName(query.from as any)
          })
          
          // Actualizar saldo en BD local inmediatamente para consistencia
          if (row.cuenta) {
            const current = await getLatestSaldoByCuenta(row.cuenta)
            if (current && current.saldo !== null) {
              await updateSingleSaldo(row.cuenta, current.saldo + row.monto)
            }
          }

          await bot.sendMessage(chatId, `✅ **Dispersión Exitosa**\n\nSe han cargado **$${(row.monto || 0).toFixed(2)}** a la cuenta/tarjeta **${row.cuenta || row.tarjeta_ultimos7}**.`, { parse_mode: 'Markdown' })
          await notifyTelegramUser(row.telegram_chat_id, `✅ **¡Gasolina Dispersada!**\n\nTu recarga por **$${(row.monto || 0).toFixed(2)}** para la cuenta/tarjeta **${row.cuenta || row.tarjeta_ultimos7}** ha sido procesada con éxito y ya está disponible.`)
        } catch (e: any) {
          console.error('[telegram] error en dispersion:', e)
          await bot.sendMessage(chatId, `❌ **Error en la dispersión**\n\nDetalle:\n\`${e.message}\``, { parse_mode: 'Markdown' })
          
          if (e.screenshotPath) {
            try {
              await bot.sendPhoto(chatId, e.screenshotPath, { caption: '📸 Captura del error en el portal' })
            } catch (photoErr) {
              console.error('[telegram] error enviando screenshot:', photoErr)
            }
          }
        }
      } else {
        await updateGasolinaRequest(requestId, { 
          status: 'rejected',
          admin_approver_id: query.from.id,
          admin_approver_name: getName(query.from as any)
        })
        await bot.sendMessage(chatId, '❌ Rechazado.')
      }
    }
  } catch (err: any) {
    console.error('[telegram] error en callback_query:', err)
  }
})

  bot.startPolling()
  return { started: true }
}

async function sendSaldoReply(chatId: number, data: { saldo: number | null; scrapedAt: Date; tarjeta?: string }, identifiedBy: string) {
  if (!activeBot) return
  if (data.saldo === null) {
    await activeBot.sendMessage(chatId, `No se encontró saldo reciente para **${identifiedBy}**.`)
    return
  }

  const dateStr = data.scrapedAt.toLocaleString('es-MX', { 
    timeZone: 'America/Mexico_City',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  const message = `💳 **Consulta de Saldo**\n\n` +
    `📍 **ID**: \`${identifiedBy}\`\n` +
    `💳 **Tarjeta**: \`${data.tarjeta || 'N/A'}\`\n` +
    `💰 **Saldo**: **$${data.saldo.toFixed(2)}**\n\n` +
    `🕒 _Actualizado el: ${dateStr}_\n\n` +
    `⚠️ *Nota:* Si notas alguna diferencia, por favor revísalo en tu App de Efectivale.`

  await activeBot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
}
