import { Router } from 'express'
import crypto from 'node:crypto'
import { mysqlEnabled } from '../store/mysql-store'

export const utilsRouter = Router()

utilsRouter.get('/encryption-key', (_req, res) => {
  const key = crypto.randomBytes(32).toString('base64')
  res.json({ key })
})

utilsRouter.get('/debug-db', (_req, res) => {
  res.json({
    mysqlEnabled: mysqlEnabled(),
    cwd: process.cwd(),
    status: 'Migración a MySQL completada'
  })
})
