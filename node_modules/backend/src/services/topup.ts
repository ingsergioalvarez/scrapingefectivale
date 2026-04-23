import { listTopupRulesMySql, listAccountsMySql } from '../store/mysql-store'
import { processEfectivaleTopup } from '../scrapers/efectivale'
import { getLatestSaldoByCuenta } from '../store/mysql-store'

/**
 * Rutina para procesar las recargas del viernes (o manual)
 */
export async function runFridayTopupsEfectivale(options: { debug?: boolean } = {}) {
  const rules = await listTopupRulesMySql()
  const enabledRules = rules.filter((r) => r.enabled && r.max_saldo > 0)

  if (enabledRules.length === 0) {
    return { processed: 0, toppedUp: 0 }
  }

  // Buscar cuenta maestra de dispersión
  const accounts = await listAccountsMySql()
  const masterAcc = accounts.find((a) => a.app === 'efectivale' && a.username.includes('D62')) || accounts[0]

  if (!masterAcc) {
    throw new Error('No hay cuenta maestra Efectivale configurada para dispersión.')
  }

  const { clienteId, consignatarioId } = JSON.parse(masterAcc.extra_json ?? '{}')
  if (!clienteId || !consignatarioId) {
    throw new Error('La cuenta maestra no tiene configurado ClienteID o ConsignatarioID.')
  }

  let toppedUpCount = 0

  for (const rule of enabledRules) {
    try {
      // Obtener saldo actual grabado en MySQL
      const info = await getLatestSaldoByCuenta(rule.cuenta)
      const currentSaldo = info?.saldo ?? 0

      if (currentSaldo < rule.min_saldo || currentSaldo === 0) {
        const montoATope = rule.max_saldo - currentSaldo
        if (montoATope > 0) {
          // eslint-disable-next-line no-console
          console.log(`[topup] recargando cuenta ${rule.cuenta}: $${currentSaldo} -> $${rule.max_saldo} (monto=$${montoATope})`)
          
          await processEfectivaleTopup({
            masterAccount: {
              id: masterAcc.id,
              username: masterAcc.username,
              passwordEnc: masterAcc.password_enc, // Cambiado
              clienteId,
              consignatarioId,
            },
            topupRule: {
              cuenta: rule.cuenta,
              monto: montoATope,
            },
            debug: options.debug || false,
          })
          toppedUpCount++
        }
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(`[topup] error procesando regla id=${rule.id} (cuenta=${rule.cuenta}):`, e?.message ?? e)
    }
  }

  return { processed: enabledRules.length, toppedUp: toppedUpCount }
}

/**
 * Alias para compatibilidad o procesos específicos si se requiere.
 */
export { processEfectivaleTopup } from '../scrapers/efectivale'
export { processEfectivaleTopup as runSingleTopup } from '../scrapers/efectivale'
