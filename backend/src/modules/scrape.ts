import { Router } from 'express'
import { getAccountMySql } from '../store/mysql-store'
import { scrapeEfectivaleSaldoSnapshotAsJson } from '../scrapers/efectivale'
import { buildEfectivaleGasolinaReporteXlsx } from '../services/reporting'
import { decryptString } from '../crypto'

export const scrapeRouter = Router()

scrapeRouter.post('/efectivale/snapshot-direct/:accountId', async (req, res) => {
  try {
    const aid = Number(req.params.accountId)
    const acc = await getAccountMySql(aid)
    if (!acc) return res.status(404).json({ error: 'Cuenta no encontrada' })

    const { clienteId, consignatarioId } = JSON.parse(acc.extra_json ?? '{}')
    if (!clienteId || !consignatarioId) {
      return res.status(400).json({ error: 'Falta ClienteID o ConsignatarioID en la cuenta' })
    }

    const data = await scrapeEfectivaleSaldoSnapshotAsJson({
      accountId: acc.id,
      creds: {
        clienteId,
        consignatarioId,
        usuario: acc.username,
        password: decryptString(acc.password_enc),
      }
    })

    res.json(data)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

scrapeRouter.get('/efectivale/report-gasolina', async (_req, res) => {
  try {
    const r = await buildEfectivaleGasolinaReporteXlsx()
    res.json(r)
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})
