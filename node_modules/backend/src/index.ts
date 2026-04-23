import express from 'express'
import cors from 'cors'
import cron from 'node-cron'
import { config } from './config'
import { accountsRouter } from './modules/accounts'
import { sessionsRouter } from './modules/sessions'
import { scrapeRouter } from './modules/scrape'
import { reportsRouter } from './modules/reports'
import { utilsRouter } from './modules/utils'
import { adminRouter } from './modules/admin'
import authRouter from './modules/auth/auth.router'
import identityRouter from './modules/identity/identity.router'
import { verificarToken } from './middleware/verificarToken'
import { verificarPermiso } from './middleware/verificarPermiso'
import { buildEfectivaleGasolinaReporteXlsx, maybeEmailReport } from './services/reporting'
import { runFridayTopupsEfectivale } from './services/topup'
import { startTelegramBot, stopTelegramBot } from './services/telegram-bot'
import { ensureMysqlTables, mysqlEnabled, listAccountsMySql, createAccountMySql, upsertSessionMySql } from './store/mysql-store'
import { listAccounts, getSession, getStorePathForDebug } from './store/excel-store'
import fs from 'node:fs'
import { runEfectivaleSaldoSnapshot } from './services/saldo-snapshot'
import { errorMiddleware } from './middleware/error'
import readline from 'node:readline'

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.get('/health', async (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRouter)
app.use('/api/identity', verificarToken, verificarPermiso('IDENTITY_GESTION'), identityRouter)
app.use('/api/accounts', verificarToken, accountsRouter)
app.use('/api/sessions', verificarToken, sessionsRouter)
app.use('/api/scrape', verificarToken, scrapeRouter)
app.use('/api/reports', verificarToken, reportsRouter)
app.use('/api/utils', verificarToken, utilsRouter)
app.use('/api/admin', verificarToken, adminRouter)
app.use(errorMiddleware)

app.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`API escuchando en http://0.0.0.0:${config.port}`)
})

if (mysqlEnabled()) {
  void (async () => {
    try {
      await ensureMysqlTables()
      
      // Migración automática de Excel a MySQL
      const accounts = await listAccountsMySql()
      if (accounts.length === 0) {
        const excelPath = getStorePathForDebug()
        if (fs.existsSync(excelPath)) {
          // eslint-disable-next-line no-console
          console.log('[boot] detectado store.xlsx y MySQL vacío, iniciando migración...')
          try {
            const excelAccounts = await listAccounts()
            for (const a of excelAccounts) {
              const aid = await createAccountMySql({
                app: a.app,
                alias: a.alias,
                username: a.username,
                password_enc: a.passwordEnc,
                extra_json: a.extraJson,
                notes: a.notes
              })
              const sess = await getSession(a.id)
              if (sess) {
                await upsertSessionMySql(aid, sess.storageStateJson)
              }
            }
            // eslint-disable-next-line no-console
            console.log(`[boot] migración completada: ${excelAccounts.length} cuentas movidas.`)
          } catch (err: any) {
             // eslint-disable-next-line no-console
            console.error('[boot] error durante migración:', err?.message ?? err)
          }
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mysql] no se pudieron crear/verificar tablas:', e?.message ?? e)
    }
  })()
}

function registerTelegramShutdownHooks() {
  const shutdown = () => {
    try {
      stopTelegramBot()
    } catch {
      // ignore
    }
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

registerTelegramShutdownHooks()

// Bot de Telegram (si está configurado)
void startTelegramBot()
  .then(async (r) => {
    if (r.started) {
      // eslint-disable-next-line no-console
      console.log('[telegram] bot iniciado')
      
      // Barrido inicial si está configurado para "boot"
      if (process.env.INITIAL_SWEEP === 'true') {
        console.log('[boot] iniciando barrido de saldos inicial...');
        try {
          const rSnapshot = await runEfectivaleSaldoSnapshot('boot')
          if ('rows' in rSnapshot) {
            console.log(`[boot] barrido completado: ${rSnapshot.rows} filas`)
            const { seedRulesFromSaldos } = await import('./store/mysql-store')
            const seedCount = await seedRulesFromSaldos()
            if (seedCount > 0) {
              console.log(`[boot] reglas sincronizadas: ${seedCount} nuevas reglas creadas.`)
            }
          }
        } catch (e: any) {
          console.error('[boot] error en barrido inicial:', e?.message ?? e)
        }
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(`[telegram] no iniciado: ${r.reason}`)
    }
  })
  .catch((e: any) => {
    // eslint-disable-next-line no-console
    console.error('[telegram] error al iniciar:', e?.message ?? e)
  })

// Corte de saldos Efectivale 5:00 (hora local del servidor) → MySQL
cron.schedule('0 5 * * *', async () => {
  try {
    const r = await runEfectivaleSaldoSnapshot('05')
    if ('skipped' in r) {
      // eslint-disable-next-line no-console
      console.log(`[saldo 5am] omitido: ${r.skipped}`)
    } else {
      // eslint-disable-next-line no-console
      console.log(`[saldo 5am] batch=${r.batchId} filas=${r.rows}`)
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[saldo 5am] error:', e?.message ?? e)
  }
})

// Rutina diaria 5pm: corte de saldos Efectivale → MySQL
cron.schedule('0 17 * * *', async () => {
  try {
    const r2 = await runEfectivaleSaldoSnapshot('17')
    if ('skipped' in r2) {
      // eslint-disable-next-line no-console
      console.log(`[saldo 5pm] omitido: ${r2.skipped}`)
    } else {
      // eslint-disable-next-line no-console
      console.log(`[saldo 5pm] batch=${r2.batchId} filas=${r2.rows}`)
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[saldo 5pm] error:', e?.message ?? e)
  }
})

// Prueba: rutina diaria 1pm para reporte Efectivale (gasolina)
cron.schedule('0 13 * * *', async () => {
  try {
    const r = await buildEfectivaleGasolinaReporteXlsx()
    const emailed = await maybeEmailReport(r.filePath, 'Reporte Efectivale (gasolina)')
    // eslint-disable-next-line no-console
    console.log(
      `[reporte 1pm] efectivale generado: ${r.filePath} | total=$${r.totalSaldo.toFixed(2)} | ${
        emailed.emailed ? 'enviado' : 'no enviado'
      }`
    )
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[reporte 1pm] efectivale error:', e?.message ?? e)
  }
})

// Rutina viernes 5pm: autocompletar saldos (Efectivale) según TopupRules
cron.schedule('0 17 * * 5', async () => {
  try {
    const r = await runFridayTopupsEfectivale({ debug: false })
    // eslint-disable-next-line no-console
    console.log(`[topup viernes 5pm] procesadas=${r.processed} recargas=${r.toppedUp}`)
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error('[topup viernes 5pm] error:', e?.message ?? e)
  }
})

