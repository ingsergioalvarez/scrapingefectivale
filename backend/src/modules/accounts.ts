import { Router } from 'express'
import { z } from 'zod'
import { encryptString } from '../crypto'
import { createAccountMySql, deleteAccountMySql, listAccountsMySql, updateAccountMySql } from '../store/mysql-store'

const EfectivaleExtraSchema = z
  .object({
    clienteId: z.string().trim().min(1),
    consignatarioId: z.string().trim().min(1),
  })
  .partial()

const CreateAccountSchema = z.object({
  alias: z.string().trim().min(1).max(100).optional(),
  username: z.string().trim().min(1).max(191),
  password: z.string().min(1),
  notes: z.string().max(5000).optional(),
  extra: z.any().optional(),
})

const UpdateAccountSchema = z.object({
  alias: z.string().trim().min(1).max(100).nullable().optional(),
  username: z.string().trim().min(1).max(191).optional(),
  password: z.string().min(1).optional(),
  notes: z.string().max(5000).nullable().optional(),
  extra: z.any().optional(),
})

export const accountsRouter = Router()

accountsRouter.get('/', async (_req, res) => {
  try {
    const rows = await listAccountsMySql()
    res.json(
      rows.map((r) => ({
        id: r.id,
        app: r.app,
        alias: r.alias,
        username: r.username,
        notes: r.notes,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        hasSession: r.hasSession,
      }))
    )
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

accountsRouter.post('/', async (req, res) => {
  try {
    const parsed = CreateAccountSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const { alias, username, password, notes } = parsed.data
    const app = 'efectivale' as const
    const password_enc = encryptString(password)
    const extraParsed = EfectivaleExtraSchema.safeParse(parsed.data.extra ?? {})
    if (!extraParsed.success || !extraParsed.data.clienteId || !extraParsed.data.consignatarioId) {
      return res.status(400).json({
        error: 'Debes capturar Cliente y Consignatario (Efectivale).',
      })
    }
    const extra_json = JSON.stringify(extraParsed.data)

    const id = await createAccountMySql({
      app,
      alias: alias ?? null,
      username,
      password_enc,
      extra_json,
      notes: notes ?? null,
    })
    res.status(201).json({ id })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

accountsRouter.patch('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

    const parsed = UpdateAccountSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

    const patch = parsed.data
    const next: any = {}

    if (patch.alias !== undefined) {
      next.alias = patch.alias
    }
    if (patch.username !== undefined) {
      next.username = patch.username
    }
    if (patch.notes !== undefined) {
      next.notes = patch.notes
    }
    if (patch.password !== undefined) {
      next.password_enc = encryptString(patch.password)
    }
    if (patch.extra !== undefined) {
      next.extra_json = patch.extra === null ? null : JSON.stringify(patch.extra)
    }

    if (Object.keys(next).length === 0) return res.json({ ok: true })
    const ok = await updateAccountMySql(id, next)
    if (!ok) return res.status(404).json({ error: 'Cuenta no encontrada' })

    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})

accountsRouter.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'id inválido' })

    await deleteAccountMySql(id)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? String(e) })
  }
})
