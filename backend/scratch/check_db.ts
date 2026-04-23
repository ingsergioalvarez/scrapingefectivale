import { pool } from '../src/db'

async function check() {
  try {
    const [rows] = await pool.query('SELECT DISTINCT cuenta FROM efectivale_saldo_rows')
    console.log('Cuentas en DB:', JSON.stringify(rows))
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
check()
