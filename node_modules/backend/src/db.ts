import mysql from 'mysql2/promise'
import { config } from './config'

export const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: '-06:00',
})

export async function pingDb() {
  const conn = await pool.getConnection()
  try {
    await conn.ping()
  } finally {
    conn.release()
  }
}

