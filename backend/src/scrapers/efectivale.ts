import { decryptString } from '../crypto'
import { chromium, type BrowserContext } from 'playwright'
import { config } from '../config'
import { getSessionMySql, upsertSessionMySql } from '../store/mysql-store'
import path from 'path'
import fs from 'fs'

// ... (rest of the file until line 287) ...

/**
 * Realiza una recarga única (dispersión) en el portal de Efectivale.
 */
export async function processEfectivaleTopup(args: {
  masterAccount: {
    id: number
    username: string
    passwordEnc: string
    clienteId: string
    consignatarioId: string
  }
  topupRule: {
    cuenta: string
    monto: number
  }
  log?: Logger
  debug?: boolean
}): Promise<{ success: boolean; message: string; error?: string; screenshotPath?: string }> {
  const logs: string[] = []
  const log: Logger = (m) => {
    const line = `[topup-run] ${new Date().toISOString()} ${m}`
    logs.push(line)
    args.log?.(line)
  }

  const headless = args.debug || process.env.EFECTIVALE_DEBUG_HEADFUL === 'true' ? false : config.playwrightHeadless
  const browser = await chromium.launch({ headless, slowMo: 100 })
  const ctx = await browser.newContext()

    let page: any
    try {
      page = await ctx.newPage()
      const password = decryptString(args.masterAccount.passwordEnc)
  
      // 1. Login
      await ensureLoggedIn(page, { ...args.masterAccount, usuario: args.masterAccount.username, password }, log)
    
    // 2. Navegación
    try {
      await gotoDisperisonTarjeta(page, log)
    } catch (e: any) {
      log(`Error navegando a dispersión: ${e.message}`)
      // Si falló navegación, tal vez la sesión expiró a medio camino
      if (page.url().includes('login')) {
         log('Detectada redirección a login durante navegación. Reintentando login...')
         await ensureLoggedIn(page, { ...args.masterAccount, usuario: args.masterAccount.username, password }, log, true)
         await gotoDisperisonTarjeta(page, log)
      } else {
         throw e
      }
    }

    // 3. Llenar Datos Directamente
    log(`Ingresando datos directos - Cuenta: ${args.topupRule.cuenta}, Monto: $${args.topupRule.monto}`)
    
    // Asegurar que estamos en la página correcta y campos visibles
    const accountInput = page.locator('input[name="cuenta"]').first()
    try {
      await accountInput.waitFor({ state: 'visible', timeout: 15000 })
    } catch (e: any) {
      const url = page.url()
      log(`TIMEOUT ERROR: No se encontró "input[name=cuenta]" en ${url}.`)
      // Intentar ver qué hay en la página
      const bodyText = await page.innerText('body').catch(() => 'no body')
      log(`Contenido parcial de la página: ${bodyText.slice(0, 300)}...`)
      throw new Error(`No se encontró el formulario de dispersión en el portal (URL actual: ${url}). Verifique si la sesión expiró o si el portal cambió.`)
    }
    
    // Llenar campos
    await accountInput.fill(args.topupRule.cuenta)
    await page.fill('input[name="montoDispersion"]', args.topupRule.monto.toString())
    
    log('Click Aceptar Inicial (xoAceptar)')
    const acceptBtn = page.locator('input[name="xoAceptar"]').first()
    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      acceptBtn.click(),
    ])
    await page.waitForTimeout(1500)

    // Verificar si estamos en la pantalla de confirmación
    const confirmText = await page.innerText('body')
    const confirmTextLower = confirmText.toLowerCase()
    
    if (
      confirmTextLower.includes('confirma') || 
      confirmTextLower.includes('aceptar') || 
      confirmTextLower.includes('presione')
    ) {
      log('Pantalla de confirmación detectada (fuzzy match). Segundo Click Aceptar...')
      const confirmBtn = page.locator('input[name="xoAceptar"]').first()
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        confirmBtn.click(),
      ])
      await page.waitForTimeout(2500)
    }

    // 5. Verificar resultado final
    const bodyFinal = await page.innerText('body')
    const bodyFinalLower = bodyFinal.toLowerCase()
    
    // Búsqueda más flexible de éxito
    if (
      bodyFinalLower.includes('éxito') || 
      bodyFinalLower.includes('exito') || 
      bodyFinalLower.includes('correctamente') ||
      bodyFinalLower.includes('dispersada') ||
      bodyFinalLower.includes('dispersion realizada')
    ) {
      log('Éxito confirmado (fuzzy match)')
      return { success: true, message: 'Dispersión completada exitosamente.' }
    }

    return { success: false, message: 'No se pudo confirmar el éxito en el portal.', error: bodyFinal.slice(0, 500) }

  } catch (e: any) {
    log(`ERROR: ${e.message}`)
    
    // Capturar screenshot en caso de error
    let screenshotPath: string | undefined
    try {
      const dir = path.join(process.cwd(), 'screenshots')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir)
      screenshotPath = path.join(dir, `error_topup_${Date.now()}.png`)
      await page.screenshot({ path: screenshotPath })
      log(`Screenshot guardado en: ${screenshotPath}`)
    } catch (ssErr) {
      log(`No se pudo tomar screenshot: ${ssErr}`)
    }

    return { success: false, message: 'Fallo en el proceso de dispersión.', error: e.message, screenshotPath }
  } finally {
    await browser.close()
  }
}

export type EfectivaleEmpleadoRow = {
  cuenta: string
  tarjeta: string
  empleado: string
  usuarioParametros: string
  saldo: number | null
}

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>
type Logger = (msg: string) => void

function parseMoneyToNumber(input: string): number | null {
  const cleaned = input.replace(/\s/g, '').replace(/[$,]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

async function closeModalIfPresent(page: any) {
  // Cierra modales/banners típicos (bootstrap) y overlays.
  const candidates = [
    'button.close',
    'button[data-dismiss="modal"]',
    'button[aria-label="Close"]',
    'button:has(i.fas.fa-times)',
    'button:has-text("Cerrar")',
    'button:has-text("Aceptar")',
    'button:has-text("Entendido")',
    '.modal-dialog button.close',
    '.modal-dialog button[aria-label="Close"]',
  ]

  for (let attempt = 0; attempt < 5; attempt++) {
    let closedAny = false

    // Caso específico observado: #myModal intercepta clicks.
    const myModal = page.locator('#myModal').first()
    if (await myModal.isVisible().catch(() => false)) {
      // Forzar a que el modal no intercepte clicks mientras lo cerramos.
      await page
        .evaluate(() => {
          const d: any = (globalThis as any).document
          const m = d?.querySelector?.('#myModal') as any
          if (m) m.style.pointerEvents = 'none'
          d?.querySelectorAll?.('.modal-backdrop')?.forEach?.((b: any) => (b.style.pointerEvents = 'none'))
        })
        .catch(() => {})

      // Intentar cerrar desde el modal
      const closeInside = myModal.locator(candidates.join(',')).first()
      if (await closeInside.isVisible().catch(() => false)) {
        await closeInside.click({ timeout: 2000 }).catch(() => {})
        closedAny = true
        await page.waitForTimeout(250)
      } else {
        // Intentar ESC
        await page.keyboard.press('Escape').catch(() => {})
        await page.waitForTimeout(250)
      }

      // Si aún visible, forzar ocultamiento del modal/backdrop
      if (await myModal.isVisible().catch(() => false)) {
        await page
          .evaluate(() => {
            const d: any = (globalThis as any).document
            if (!d) return
            const m = d.querySelector('#myModal') as any
            if (m) {
              m.classList.remove('in')
              m.style.display = 'none'
              m.setAttribute('aria-hidden', 'true')
            }
            d.querySelectorAll('.modal-backdrop').forEach((b: any) => b.remove())
            d.body?.classList?.remove('modal-open')
          })
          .catch(() => {})
        closedAny = true
        await page.waitForTimeout(250)
      }
    }

    for (const sel of candidates) {
      const btn = page.locator(sel).first()
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 2000 }).catch(() => {})
        closedAny = true
        await page.waitForTimeout(250)
      }
    }
    if (!closedAny) break
  }
}

async function ensureLoggedIn(
  page: any,
  creds: { clienteId: string; consignatarioId: string; usuario: string; password: string },
  log: Logger,
  force: boolean = false
) {
  log('Verificando estado de sesión...')
  const currentUrl = page.url()
  const isLoginPage = currentUrl.includes('login')
  const loginFormVisible = await page.locator('input[name="clienteID"]').isVisible().catch(() => false)
  
  if (!force && !isLoginPage && !loginFormVisible) {
    // Si no estamos en login y el formulario no es visible, probamos si el menú existe
    const hasMenu = await page.getByText('Menú Efectinet').isVisible().catch(() => false)
    if (hasMenu) {
      log('Sesión parece activa (Menú detectable)')
      return
    }
  }

  log('Iniciando proceso de Login...')
  await page.goto('https://www.efectivale.com.mx/efectinet/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  log('Llenar campos de login')
  await page.fill('input[name="clienteID"]', creds.clienteId)
  await page.fill('input[name="consignatarioID"]', creds.consignatarioId)
  await page.fill('input[name="usuarioUSR"]', creds.usuario)
  await page.fill('input[name="usuarioPWD"]', creds.password)

  log('Click Ingresar')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
    page.click('input[name="Ingresar"]'),
  ])

  log('Cerrar modal si aparece')
  await closeModalIfPresent(page)
  
  // Verificación final de login
  const loggedIn = await page.getByText('Menú Efectinet').isVisible().catch(() => false)
  if (!loggedIn) {
    log('ADVERTENCIA: No se detectó el menú principal tras login.')
  } else {
    log('Login exitoso confirmado.')
  }
}

async function gotoDisperisonTarjeta(page: any, log: Logger) {
  // Menú Efectinet -> Administración de Servicios -> Efecticard Corporativo ->
  // Administración Monedero Corporativo -> Dispersión Tarjeta Corporativo
  // La UI es por divs con onclick; usar texto es más robusto.
  log('Abrir menú: Menú Efectinet')
  await closeModalIfPresent(page)
  await page.getByText('Menú Efectinet', { exact: true }).click({ timeout: 20000, force: true })
  log('Click: Administración de Servicios')
  await closeModalIfPresent(page)
  await page.getByText('Administración de Servicios', { exact: true }).click({ timeout: 20000, force: true })
  log('Click: Efecticard Corporativo')
  await closeModalIfPresent(page)
  await page.getByText('Efecticard Corporativo', { exact: true }).click({ timeout: 20000, force: true })
  log('Click: Administración Monedero Corporativo')
  await closeModalIfPresent(page)
  await page.getByText('Administración Monedero Corporativo', { exact: true }).click({ timeout: 20000, force: true })
  log('Click: Dispersión Tarjeta Corporativo')
  await closeModalIfPresent(page)
  await page.getByText('Dispersión Tarjeta Corporativo', { exact: true }).click({ timeout: 20000, force: true })
  await page.waitForTimeout(700)
}

function extractEmpleadosFromTable(htmlTexts: string[][]): EfectivaleEmpleadoRow[] {
  const out: EfectivaleEmpleadoRow[] = []
  for (const tds of htmlTexts) {
    // layout: [radio, Cuenta, Tarjeta, Empleado, Usuario Parametros, Saldo]
    if (tds.length < 6) continue
    const cuenta = tds[1]?.trim() ?? ''
    const tarjeta = tds[2]?.trim() ?? ''
    const empleado = tds[3]?.trim() ?? ''
    const usuarioParametros = tds[4]?.trim() ?? ''
    const saldo = parseMoneyToNumber(tds[5] ?? '')
    if (cuenta) out.push({ cuenta, tarjeta, empleado, usuarioParametros, saldo })
  }
  return out
}

async function readCurrentPageRows(page: any): Promise<EfectivaleEmpleadoRow[]> {
  // Usar textContent para no perder valores cuando hay spans/nbsp.
  const texts: string[][] = await page.$$eval('table.DT tr.DF1, table.DT tr.DF2', (trs: any[]) =>
    trs.map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) =>
        (String((td as any).textContent ?? '')).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
      )
    )
  )

  // Algunas variantes agregan columnas; usamos el último TD como saldo.
  const normalized = texts.map((tds) => {
    if (tds.length < 6) return tds
    const saldo = tds[tds.length - 1]
    const base = tds.slice(0, 5)
    return [...base, saldo]
  })

  return extractEmpleadosFromTable(normalized)
}

async function getPagerText(page: any): Promise<string> {
  const pager = page.locator('td.IFT').first()
  return (await pager.innerText().catch(() => '')).trim()
}

export async function scrapeEfectivaleEmpleados(args: {
  creds: { clienteId: string; consignatarioId: string; usuario: string; password: string }
  storageState?: StorageState
  log?: Logger
  debug?: boolean
}): Promise<{ rows: EfectivaleEmpleadoRow[]; storageState: StorageState; logs: string[] }> {
  const logs: string[] = []
  const log: Logger = (m) => {
    const line = `[efectivale] ${new Date().toISOString()} ${m}`
    logs.push(line)
    args.log?.(line)
  }

  const headless = args.debug || process.env.EFECTIVALE_DEBUG_HEADFUL === 'true' ? false : config.playwrightHeadless
  const slowMo = Number(process.env.EFECTIVALE_SLOWMO_MS ?? 0) || 0
  const browser = await chromium.launch({ headless, slowMo })
  const ctx = await browser.newContext(args.storageState ? { storageState: args.storageState } : {})
  try {
    const page = await ctx.newPage()
    let step = 'login'
    try {
      await ensureLoggedIn(page, args.creds, log)
      step = 'menu'
      await gotoDisperisonTarjeta(page, log)
      step = 'table'
    } catch (e: any) {
      throw new Error(`Fallo en paso "${step}": ${e?.message ?? String(e)}`)
    }

    const all: EfectivaleEmpleadoRow[] = []
    const seen = new Set<string>()

    let lastPager = ''
    for (let guard = 0; guard < 60; guard++) {
      log(`Leer página ${guard + 1}`)
      const pager = await getPagerText(page)
      if (pager && pager === lastPager) break
      lastPager = pager

      const rows = await readCurrentPageRows(page)
      for (const r of rows) {
        const key = `${r.cuenta}-${r.tarjeta}`
        if (!seen.has(key)) {
          seen.add(key)
          all.push(r)
        }
      }

      const nextBtn = page.locator('input[name="xoSiguiente"]').first()
      const canNext = await nextBtn.isVisible().catch(() => false)
      if (!canNext) break

      log('Click: Siguiente')
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        nextBtn.click(),
      ])
      await page.waitForTimeout(400)
    }

    const storageState = await ctx.storageState()
    log(`OK. Filas totales: ${all.length}`)
    return { rows: all, storageState, logs }
  } finally {
    await browser.close()
  }
}

/**
 * Orquestador que maneja sesiones en MySQL y scrapea empleados/saldos de una cuenta.
 */
export async function scrapeEfectivaleSaldoSnapshotAsJson(args: {
  accountId: number
  creds: { clienteId: string; consignatarioId: string; usuario: string; password: string }
  log?: (m: string) => void
  debug?: boolean
}) {
  // 1. Obtener sesión persistente si existe
  const storageState = await getSessionMySql(args.accountId)
  
  // 2. Ejecutar scrap
  let playwrightStorageState: any = undefined
  if (storageState?.storage_state_json) {
    try {
      playwrightStorageState = JSON.parse(storageState.storage_state_json)
    } catch (e) {
      args.log?.(`Error parseando sesión previa: ${String(e)}`)
    }
  }

  const result = await scrapeEfectivaleEmpleados({
    creds: args.creds,
    storageState: playwrightStorageState,
    log: args.log,
    debug: args.debug
  })

  // 3. Persistir nueva sesión
  if (result.storageState) {
    await upsertSessionMySql(args.accountId, JSON.stringify(result.storageState))
  }

  // 4. Retornar filas
  return result.rows
}
