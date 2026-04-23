import { pool } from '../src/db'

async function checkSchema() {
  try {
    const [rows]: any = await pool.query('DESCRIBE telegram_gasolina_requests')
    console.log('Schema:', JSON.stringify(rows))
    process.exit(0)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
}
checkSchema()
