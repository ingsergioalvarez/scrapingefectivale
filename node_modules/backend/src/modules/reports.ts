import { Router } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { buildEfectivaleGasolinaReporteXlsx, maybeEmailReport } from '../services/reporting'

export const reportsRouter = Router()

let lastEfectivale: { filePath: string; createdAt: string; totalSaldo: number; cuentas: number; empleados: number } | null = null

reportsRouter.post('/efectivale/run-now', async (_req, res) => {
  const r = await buildEfectivaleGasolinaReporteXlsx()
  await maybeEmailReport(r.filePath, 'Reporte Efectivale (gasolina)')
  lastEfectivale = {
    filePath: r.filePath,
    createdAt: new Date().toISOString(),
    totalSaldo: r.totalSaldo,
    cuentas: r.rowCount,
    empleados: r.rowCount,
  }
  res.json({ ok: true, ...lastEfectivale })
})

reportsRouter.get('/efectivale/last', async (_req, res) => {
  if (lastEfectivale) return res.json(lastEfectivale)

  const dir = path.resolve(process.cwd(), 'reports')
  if (!fs.existsSync(dir)) return res.status(404).json({ error: 'Sin reportes' })

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('reporte-efectivale-gasolina-') && f.endsWith('.xlsx'))
    .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)

  if (!files.length) return res.status(404).json({ error: 'Sin reportes Efectivale' })
  res.json({ filePath: path.join(dir, files[0].f), createdAt: new Date(files[0].t).toISOString() })
})
