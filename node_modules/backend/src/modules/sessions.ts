import { Router } from 'express'
import { deleteAccountMySql, getSessionMySql, upsertSessionMySql } from '../store/mysql-store'

export const sessionsRouter = Router()

sessionsRouter.get('/:accountId', async (req, res) => {
  try {
    const accountId = Number(req.params.accountId)
    if (!Number.isFinite(accountId)) return res.status(400).json({ error: 'id inválido' })

    const sess = await getSessionMySql(accountId)
    if (!sess) return res.status(404).json({ error: 'Sesión no encontrada' })

    res.json({
      accountId: sess.account_id,
      storageStateJson: sess.storage_state_json,
      updatedAt: sess.updated_at,
    })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

sessionsRouter.post('/:accountId', async (req, res) => {
  try {
    const accountId = Number(req.params.accountId)
    if (!Number.isFinite(accountId)) return res.status(400).json({ error: 'id inválido' })

    const { storageStateJson } = req.body
    if (!storageStateJson) return res.status(400).json({ error: 'Falta storageStateJson' })

    await upsertSessionMySql(accountId, storageStateJson)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

sessionsRouter.delete('/:accountId', async (req, res) => {
  try {
    const accountId = Number(req.params.accountId)
    if (!Number.isFinite(accountId)) return res.status(400).json({ error: 'id inválido' })

    // En MySQL, borrar la sesión es simplemente borrar la fila en efectivale_sessions,
    // pero la función deleteAccountMySql ya lo hace. Si queremos borrar solo la sesión:
    const { pool } = await import('../db')
    await pool.execute(`DELETE FROM efectivale_sessions WHERE account_id = ?`, [accountId])
    
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})
