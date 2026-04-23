import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'

export type AppName = 'efectivale'

export type StoredAccount = {
  id: number
  app: AppName
  alias: string | null
  username: string
  passwordEnc: string
  extraJson: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type StoredSession = {
  accountId: number
  storageStateJson: string
  updatedAt: string
}

export type StoredTopupRule = {
  id: number
  // Login Efectivale a usar para hacer la dispersión
  efectivaleAccountId: number
  // Cuenta (Efectivale) objetivo a recargar
  cuenta: string
  minSaldo: number
  maxSaldo: number
  enabled: boolean
  // Lista de actividades para Telegram u operación manual (JSON string)
  activitiesJson: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

type StoreData = {
  accounts: StoredAccount[]
  sessions: StoredSession[]
  topupRules: StoredTopupRule[]
}

function parseIsoOr0(s: string) {
  const t = Date.parse(s)
  return Number.isFinite(t) ? t : 0
}

function normalizeStore(data: StoreData): StoreData {
  // Dedupe accounts by (app, username, extraJson). Keep the most recently updated.
  const byKey = new Map<string, StoredAccount>()
  for (const a of data.accounts) {
    const key = `${a.app}|${a.username}|${a.extraJson ?? ''}`
    const prev = byKey.get(key)
    if (!prev || parseIsoOr0(a.updatedAt) >= parseIsoOr0(prev.updatedAt)) {
      byKey.set(key, a)
    }
  }

  const accounts = Array.from(byKey.values()).filter((a) => a.app === 'efectivale')

  // Ensure unique IDs (if collisions across different keys ever happen)
  const usedIds = new Set<number>()
  let nextId = accounts.reduce((m, a) => Math.max(m, a.id), 0) + 1
  for (const a of accounts) {
    if (!Number.isFinite(a.id) || usedIds.has(a.id)) {
      a.id = nextId++
    }
    usedIds.add(a.id)
  }

  // Sessions: keep latest per accountId
  const sessById = new Map<number, StoredSession>()
  for (const s of data.sessions) {
    const prev = sessById.get(s.accountId)
    if (!prev || parseIsoOr0(s.updatedAt) >= parseIsoOr0(prev.updatedAt)) {
      sessById.set(s.accountId, s)
    }
  }

  const sessions = Array.from(sessById.values()).filter((s) => usedIds.has(s.accountId))

  // Topup rules: unique by (efectivaleAccountId, cuenta). Keep most recently updated.
  const ruleByKey = new Map<string, StoredTopupRule>()
  for (const r of data.topupRules ?? []) {
    const key = `${Number(r.efectivaleAccountId)}|${String(r.cuenta ?? '').trim()}`
    const prev = ruleByKey.get(key)
    if (!prev || parseIsoOr0(r.updatedAt) >= parseIsoOr0(prev.updatedAt)) ruleByKey.set(key, r)
  }
  const topupRules = Array.from(ruleByKey.values()).filter((r) => r.cuenta && Number.isFinite(r.efectivaleAccountId))

  // Ensure unique IDs inside rules
  const usedRuleIds = new Set<number>()
  let nextRuleId = topupRules.reduce((m, r) => Math.max(m, r.id), 0) + 1
  for (const r of topupRules) {
    if (!Number.isFinite(r.id) || usedRuleIds.has(r.id)) r.id = nextRuleId++
    usedRuleIds.add(r.id)
  }

  return { accounts, sessions, topupRules }
}

function nowIso() {
  return new Date().toISOString()
}

function serverRoot() {
  // .../server/src/store/excel-store.ts -> .../server
  return path.resolve(__dirname, '..', '..')
}

function storePath() {
  return path.join(serverRoot(), 'data', 'store.xlsx')
}

export function getStorePathForDebug() {
  return storePath()
}

function ensureDir() {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true })
}

let queue = Promise.resolve<void>(undefined)

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void
  const next = new Promise<void>((r) => (release = r))
  const prev = queue
  queue = prev.then(() => next)
  await prev
  try {
    return await fn()
  } finally {
    release()
  }
}

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  ensureDir()
  const p = storePath()
  const wb = new ExcelJS.Workbook()

  // Migración: antes guardábamos en <repo>/data/store.xlsx por error.
  const legacyPath = path.resolve(serverRoot(), '..', 'data', 'store.xlsx')
  if (!fs.existsSync(p) && fs.existsSync(legacyPath)) {
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.copyFileSync(legacyPath, p)
  }

  if (fs.existsSync(p)) {
    await wb.xlsx.readFile(p)
    // Migración de columnas: agregar extraJson si falta.
    const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0]
    const headerRow = accountsWs.getRow(1)
    const headers: string[] = []
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim()
    })
    if (!headers.includes('extraJson')) {
      const nextCol = headers.length + 1
      headerRow.getCell(nextCol).value = 'extraJson'
      accountsWs.getColumn(nextCol).width = 60
      headerRow.commit()
      await wb.xlsx.writeFile(p)
    }

    // Migración/creación: TopupRules
    if (!wb.getWorksheet('TopupRules')) {
      const rules = wb.addWorksheet('TopupRules')
      rules.columns = [
        { header: 'id', key: 'id', width: 10 },
        { header: 'efectivaleAccountId', key: 'efectivaleAccountId', width: 18 },
        { header: 'cuenta', key: 'cuenta', width: 14 },
        { header: 'minSaldo', key: 'minSaldo', width: 12 },
        { header: 'maxSaldo', key: 'maxSaldo', width: 12 },
        { header: 'enabled', key: 'enabled', width: 10 },
        { header: 'activitiesJson', key: 'activitiesJson', width: 60 },
        { header: 'notes', key: 'notes', width: 40 },
        { header: 'createdAt', key: 'createdAt', width: 28 },
        { header: 'updatedAt', key: 'updatedAt', width: 28 },
      ]
      await wb.xlsx.writeFile(p)
    }
    return wb
  }

  wb.creator = 'Control Vehicular'
  wb.created = new Date()

  const accounts = wb.addWorksheet('Accounts')
  accounts.columns = [
    { header: 'id', key: 'id', width: 10 },
    { header: 'app', key: 'app', width: 15 },
    { header: 'alias', key: 'alias', width: 25 },
    { header: 'username', key: 'username', width: 30 },
    { header: 'passwordEnc', key: 'passwordEnc', width: 60 },
    { header: 'extraJson', key: 'extraJson', width: 60 },
    { header: 'notes', key: 'notes', width: 40 },
    { header: 'createdAt', key: 'createdAt', width: 28 },
    { header: 'updatedAt', key: 'updatedAt', width: 28 },
  ]

  const sessions = wb.addWorksheet('Sessions')
  sessions.columns = [
    { header: 'accountId', key: 'accountId', width: 12 },
    { header: 'storageStateJson', key: 'storageStateJson', width: 90 },
    { header: 'updatedAt', key: 'updatedAt', width: 28 },
  ]

  const topupRules = wb.addWorksheet('TopupRules')
  topupRules.columns = [
    { header: 'id', key: 'id', width: 10 },
    { header: 'efectivaleAccountId', key: 'efectivaleAccountId', width: 18 },
    { header: 'cuenta', key: 'cuenta', width: 14 },
    { header: 'minSaldo', key: 'minSaldo', width: 12 },
    { header: 'maxSaldo', key: 'maxSaldo', width: 12 },
    { header: 'enabled', key: 'enabled', width: 10 },
    { header: 'activitiesJson', key: 'activitiesJson', width: 60 },
    { header: 'notes', key: 'notes', width: 40 },
    { header: 'createdAt', key: 'createdAt', width: 28 },
    { header: 'updatedAt', key: 'updatedAt', width: 28 },
  ]

  await wb.xlsx.writeFile(p)
  return wb
}

function sheetToJson<T>(ws: ExcelJS.Worksheet): T[] {
  const out: any[] = []
  const headerRow = ws.getRow(1)
  const keys: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    keys[colNumber - 1] = String(cell.value ?? '').trim()
  })

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const obj: any = {}
    let hasAny = false
    keys.forEach((k, idx) => {
      const v = row.getCell(idx + 1).value
      if (v !== null && v !== undefined && v !== '') hasAny = true
      obj[k] = typeof v === 'object' && v && 'text' in (v as any) ? (v as any).text : v
    })
    if (hasAny) out.push(obj)
  }
  return out as T[]
}

function replaceSheet(ws: ExcelJS.Worksheet, rows: any[]) {
  // borrar todo excepto header
  if (ws.rowCount > 1) ws.spliceRows(2, ws.rowCount - 1)
  const headerRow = ws.getRow(1)
  const headers: string[] = []
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim()
  })

  for (const r of rows) {
    const values = headers.map((h) => (h ? (r[h] ?? null) : null))
    ws.addRow(values)
  }
}

async function readStoreUnlocked(): Promise<StoreData> {
  const wb = await loadWorkbook()
  const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0]
  const sessionsWs = wb.getWorksheet('Sessions') ?? wb.worksheets[1]
  const rulesWs = wb.getWorksheet('TopupRules')

  const accountsRaw = sheetToJson<any>(accountsWs)
    .map((a) => ({
      id: Number(a.id),
      app: a.app as AppName,
      alias: a.alias ?? null,
      username: String(a.username ?? ''),
      passwordEnc: String(a.passwordEnc ?? ''),
      extraJson: a.extraJson ? String(a.extraJson) : null,
      notes: a.notes ?? null,
      createdAt: String(a.createdAt ?? ''),
      updatedAt: String(a.updatedAt ?? ''),
    }))
    .filter((a) => String(a.app).toLowerCase() === 'efectivale') as StoredAccount[]

  const sessionsRaw = sheetToJson<any>(sessionsWs).map((s) => ({
    accountId: Number(s.accountId),
    storageStateJson: String(s.storageStateJson ?? ''),
    updatedAt: String(s.updatedAt ?? ''),
  })) as StoredSession[]

  const rulesRaw = rulesWs
    ? (sheetToJson<any>(rulesWs).map((r) => ({
        id: Number(r.id),
        efectivaleAccountId: Number(r.efectivaleAccountId),
        cuenta: String(r.cuenta ?? '').trim(),
        minSaldo: Number(r.minSaldo ?? 0),
        maxSaldo: Number(r.maxSaldo ?? 0),
        enabled: String(r.enabled ?? 'true').toLowerCase() !== 'false' && Number(r.enabled ?? 1) !== 0,
        activitiesJson: r.activitiesJson ? String(r.activitiesJson) : null,
        notes: r.notes ?? null,
        createdAt: String(r.createdAt ?? ''),
        updatedAt: String(r.updatedAt ?? ''),
      })) as StoredTopupRule[])
    : ([] as StoredTopupRule[])

  const normalized = normalizeStore({
    accounts: accountsRaw.filter((a) => Number.isFinite(a.id)),
    sessions: sessionsRaw.filter((s) => Number.isFinite(s.accountId)),
    topupRules: rulesRaw.filter((r) => Number.isFinite(r.efectivaleAccountId) && !!r.cuenta),
  })
  return normalized
}

async function writeStoreUnlocked(data: StoreData) {
  const normalized = normalizeStore(data)
  const wb = await loadWorkbook()
  const accountsWs = wb.getWorksheet('Accounts') ?? wb.worksheets[0]
  const sessionsWs = wb.getWorksheet('Sessions') ?? wb.worksheets[1]
  const rulesWs = wb.getWorksheet('TopupRules')

  replaceSheet(accountsWs, normalized.accounts)
  replaceSheet(sessionsWs, normalized.sessions)
  if (rulesWs) replaceSheet(rulesWs, normalized.topupRules)

  await wb.xlsx.writeFile(storePath())
}

export async function listAccounts(): Promise<(StoredAccount & { hasSession: boolean })[]> {
  return withLock(async () => {
    const { accounts, sessions } = await readStoreUnlocked()
    const sessionSet = new Set(sessions.map((s) => s.accountId))
    return accounts
      .slice()
      .sort((a, b) => b.id - a.id)
      .map((a) => ({ ...a, hasSession: sessionSet.has(a.id) }))
  })
}

export async function listTopupRules(): Promise<StoredTopupRule[]> {
  return withLock(async () => {
    const { topupRules } = await readStoreUnlocked()
    return topupRules.slice().sort((a, b) => b.id - a.id)
  })
}

export async function upsertTopupRule(
  input: Omit<StoredTopupRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: number }
): Promise<number> {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    const t = nowIso()

    const key = `${Number(input.efectivaleAccountId)}|${String(input.cuenta ?? '').trim()}`
    const existing =
      input.id != null ? store.topupRules.find((r) => r.id === input.id) : store.topupRules.find((r) => `${r.efectivaleAccountId}|${r.cuenta}` === key)

    if (existing) {
      existing.efectivaleAccountId = Number(input.efectivaleAccountId)
      existing.cuenta = String(input.cuenta ?? '').trim()
      existing.minSaldo = Number(input.minSaldo ?? 0)
      existing.maxSaldo = Number(input.maxSaldo ?? 0)
      existing.enabled = !!input.enabled
      existing.activitiesJson = input.activitiesJson ?? null
      existing.notes = input.notes ?? null
      existing.updatedAt = t
      await writeStoreUnlocked(store)
      return existing.id
    }

    const nextId = store.topupRules.reduce((m, r) => Math.max(m, r.id), 0) + 1
    store.topupRules.push({
      id: nextId,
      efectivaleAccountId: Number(input.efectivaleAccountId),
      cuenta: String(input.cuenta ?? '').trim(),
      minSaldo: Number(input.minSaldo ?? 0),
      maxSaldo: Number(input.maxSaldo ?? 0),
      enabled: !!input.enabled,
      activitiesJson: input.activitiesJson ?? null,
      notes: input.notes ?? null,
      createdAt: t,
      updatedAt: t,
    })
    await writeStoreUnlocked(store)
    return nextId
  })
}

export async function deleteTopupRule(id: number) {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    store.topupRules = store.topupRules.filter((r) => r.id !== id)
    await writeStoreUnlocked(store)
  })
}

export async function createAccount(input: Omit<StoredAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    const t = nowIso()

    // Evitar duplicados: si ya existe (app+username+extraJson) actualizamos password/alias/notes.
    const key = `${input.app}|${input.username}|${input.extraJson ?? ''}`
    const existing = store.accounts.find((a) => `${a.app}|${a.username}|${a.extraJson ?? ''}` === key)
    if (existing) {
      existing.alias = input.alias
      existing.passwordEnc = input.passwordEnc
      existing.notes = input.notes
      existing.updatedAt = t
      await writeStoreUnlocked(store)
      return existing.id
    }

    const nextId = store.accounts.reduce((m, a) => Math.max(m, a.id), 0) + 1
    store.accounts.push({ id: nextId, ...input, createdAt: t, updatedAt: t })
    await writeStoreUnlocked(store)
    return nextId
  })
}

export async function updateAccount(
  id: number,
  patch: Partial<Pick<StoredAccount, 'alias' | 'username' | 'passwordEnc' | 'extraJson' | 'notes'>>
) {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    const idx = store.accounts.findIndex((a) => a.id === id)
    if (idx < 0) return false
    store.accounts[idx] = { ...store.accounts[idx], ...patch, updatedAt: nowIso() }
    await writeStoreUnlocked(store)
    return true
  })
}

export async function deleteAccount(id: number) {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    store.accounts = store.accounts.filter((a) => a.id !== id)
    store.sessions = store.sessions.filter((s) => s.accountId !== id)
    await writeStoreUnlocked(store)
  })
}

export async function getAccount(id: number): Promise<StoredAccount | null> {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    return store.accounts.find((a) => a.id === id) ?? null
  })
}

export async function getSession(accountId: number): Promise<StoredSession | null> {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    return store.sessions.find((s) => s.accountId === accountId) ?? null
  })
}

export async function upsertSession(accountId: number, storageStateJson: string) {
  return withLock(async () => {
    const store = await readStoreUnlocked()
    const t = nowIso()
    const idx = store.sessions.findIndex((s) => s.accountId === accountId)
    if (idx >= 0) store.sessions[idx] = { accountId, storageStateJson, updatedAt: t }
    else store.sessions.push({ accountId, storageStateJson, updatedAt: t })
    await writeStoreUnlocked(store)
  })
}

