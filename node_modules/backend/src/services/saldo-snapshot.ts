import { listAccountsMySql, upsertSaldoRows, SaldoSlot } from '../store/mysql-store'
import { scrapeEfectivaleSaldoSnapshotAsJson } from '../scrapers/efectivale'
import { randomUUID } from 'node:crypto'
import { decryptString } from '../crypto'

/**
 * Ejecuta el barrido de saldos de todas las cuentas Efectivale cargadas.
 */
export async function runEfectivaleSaldoSnapshot(slot: SaldoSlot) {
  const accounts = await listAccountsMySql()
  const efectivaleAccounts = accounts.filter((a) => a.app === 'efectivale')

  if (efectivaleAccounts.length === 0) {
    return { skipped: 'No hay cuentas Efectivale configuradas' }
  }

  const batchId = randomUUID()
  const scrapedAt = new Date()
  let totalRows = 0

  for (const acc of efectivaleAccounts) {
    try {
      const { clienteId, consignatarioId } = JSON.parse(acc.extra_json ?? '{}')
      if (!clienteId || !consignatarioId) {
        // eslint-disable-next-line no-console
        console.warn(`[saldo-snapshot] cuenta id=${acc.id} (${acc.username}) no tiene clienteId/consignatarioId. Saltada.`)
        continue
      }

      const rows = await scrapeEfectivaleSaldoSnapshotAsJson({
        accountId: acc.id,
        creds: {
          clienteId,
          consignatarioId,
          usuario: acc.username,
          password: decryptString(acc.password_enc),
        }
      })

      if (rows.length > 0) {
        await upsertSaldoRows(
          slot,
          scrapedAt,
          rows.map((r) => ({
            efectivaleAccountId: acc.id,
            origenLabel: acc.alias || acc.username,
            cuenta: r.cuenta,
            tarjeta: r.tarjeta,
            empleado: r.empleado,
            usuarioParametros: r.usuarioParametros,
            saldo: r.saldo,
          }))
        )
        totalRows += rows.length
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error(`[saldo-snapshot] error raspando cuenta id=${acc.id}:`, e?.message ?? e)
    }
  }

  return { batchId, rows: totalRows }
}
