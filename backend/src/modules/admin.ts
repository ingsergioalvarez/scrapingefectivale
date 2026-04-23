import { Router } from 'express'
import {
  getGasolinaRequest,
  listGasolinaRequests,
  mysqlEnabled,
  updateGasolinaRequest,
  listTopupRulesMySql,
  upsertTopupRuleMySql,
  deleteTopupRuleMySql,
  seedRulesFromSaldos,
  listLatestBalances,
  listChoferes,
  getChoferHistory,
  createChofer,
  updateChofer,
  deleteChofer,
  assignAssetsToChofer,
  listVehiculos,
  createVehiculo,
  updateVehiculo,
  deleteVehiculo,
  listAccountsMySql,
} from '../store/mysql-store'
import { runSingleTopupRequest } from '../services/telegram-helpers'
import { notifyTelegramUser } from '../services/telegram-notify'

export const adminRouter = Router()

// --- CUENTAS (ACCESOS) ---
adminRouter.get('/accounts', async (_req, res) => {
  try {
    const rows = await listAccountsMySql()
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

// --- CHOFERES ---
adminRouter.get('/choferes', async (_req, res) => {
  try {
    const rows = await listChoferes()
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/choferes', async (req, res) => {
  try {
    const id = await createChofer(req.body.nombre)
    res.json({ ok: true, id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.put('/choferes/:id', async (req, res) => {
  try {
    await updateChofer(Number(req.params.id), req.body.nombre)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.delete('/choferes/:id', async (req, res) => {
  try {
    await deleteChofer(Number(req.params.id))
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.put('/choferes/:id/assets', async (req, res) => {
  try {
    const { vehiculo_id, cuenta } = req.body
    await assignAssetsToChofer(Number(req.params.id), vehiculo_id || null, cuenta || null)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.get('/choferes/:id/history', async (req, res) => {
  try {
    const history = await getChoferHistory(Number(req.params.id))
    res.json(history)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

// --- VEHÍCULOS ---
adminRouter.get('/vehiculos', async (_req, res) => {/*  */
  try {
    const rows = await listVehiculos()
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/vehiculos', async (req, res) => {
  try {
    const id = await createVehiculo(req.body)
    res.json({ ok: true, id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.put('/vehiculos/:id', async (req, res) => {
  try {
    await updateVehiculo(Number(req.params.id), req.body)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.delete('/vehiculos/:id', async (req, res) => {
  try {
    await deleteVehiculo(Number(req.params.id))
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

function adminAuth(req: any, res: any, next: any) {
  const expected = process.env.ADMIN_API_KEY
  // Si no hay clave configurada en el servidor, permitimos acceso libre (uso local)
  if (!expected) {
    return next()
  }
  const key = String(req.headers['x-admin-key'] ?? '')
  if (key !== expected) {
    res.status(401).json({ error: 'No autorizado. Se requiere x-admin-key válida.' })
    return
  }
  next()
}

adminRouter.use(adminAuth)

adminRouter.get('/mysql-status', (_req, res) => {
  res.json({ enabled: mysqlEnabled() })
})

adminRouter.get('/balances', async (_req, res) => {
  try {
    const rows = await listLatestBalances()
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.get('/gasolina', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const rows = await listGasolinaRequests(status)
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/gasolina/:id/approve', async (req, res) => {
  try {
    const row = await getGasolinaRequest(req.params.id)
    if (!row || row.status !== 'pending') {
      res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' })
      return
    }
    const note = req.body?.note != null ? String(req.body.note) : null
    const payload: {
      cuenta?: string
      tarjetaUltimos7?: string
      requestedMonto: number
      debug?: boolean
    } = {
      requestedMonto: row.monto,
      debug: false,
    }
    if (row.id_tipo === 'cuenta') {
      if (!row.cuenta) {
        res.status(400).json({ error: 'Solicitud sin cuenta' })
        return
      }
      payload.cuenta = row.cuenta
    } else {
      if (!row.tarjeta_ultimos7) {
        res.status(400).json({ error: 'Solicitud sin tarjeta' })
        return
      }
      payload.tarjetaUltimos7 = row.tarjeta_ultimos7
    }

    const result = await runSingleTopupRequest(payload)
    await updateGasolinaRequest(row.id, { 
      status: 'dispersed', 
      admin_note: note, 
      error_message: null,
      admin_approver_name: 'Dashboard Admin',
      admin_approver_id: 1
    })
    await notifyTelegramUser(
      row.telegram_chat_id,
      `Tu carga de gasolina ya fue dispersada.\n${result.message}\n\nGracias por usar mis servicios.`
    )
    res.json({ ok: true, result })
  } catch (e: any) {
    try {
      const row = await getGasolinaRequest(req.params.id)
      if (row) {
        await updateGasolinaRequest(row.id, { 
          status: 'error', 
          error_message: e?.message ?? String(e),
          admin_approver_name: 'Dashboard Admin (Failed)',
          admin_approver_id: 1
        })
      }
      if (row) {
        await notifyTelegramUser(
          row.telegram_chat_id,
          `No se pudo completar tu recarga: ${e?.message ?? e}\n\nGracias por usar mis servicios.`
        )
      }
    } catch {
      // ignore
    }
    res.status(502).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/gasolina/:id/reject', async (req, res) => {
  try {
    const row = await getGasolinaRequest(req.params.id)
    if (!row || row.status !== 'pending') {
      res.status(404).json({ error: 'Solicitud no encontrada o ya procesada' })
      return
    }
    const note = req.body?.note != null ? String(req.body.note) : null
    await updateGasolinaRequest(row.id, { 
      status: 'rejected', 
      admin_note: note,
      admin_approver_name: 'Dashboard Admin',
      admin_approver_id: 1
    })
    await notifyTelegramUser(
      row.telegram_chat_id,
      `Tu solicitud de gasolina no fue autorizada.${note ? ` Nota: ${note}` : ''}\n\nGracias por usar mis servicios.`
    )
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

// --- REGLAS DE RECARGA ---

adminRouter.get('/rules', async (_req, res) => {
  try {
    const rows = await listTopupRulesMySql()
    res.json(rows)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/rules', async (req, res) => {
  try {
    const id = await upsertTopupRuleMySql(req.body)
    res.json({ ok: true, id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.delete('/rules/:id', async (req, res) => {
  try {
    await deleteTopupRuleMySql(Number(req.params.id))
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

adminRouter.post('/rules/seed', async (_req, res) => {
  try {
    const count = await seedRulesFromSaldos()
    res.json({ ok: true, count })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})
