import fs from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { config } from '../src/config'

function splitSqlStatements(sql: string): string[] {
  // Muy simple: funciona para nuestro init.sql (sin ; dentro de strings).
  return sql
    .split(/;\s*[\r\n]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

async function main() {
  const sqlPath = path.resolve('sql', 'init.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  const statements = splitSqlStatements(sql)

  // 1) Conectar sin DB para poder crearla si no existe
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
  })

  try {
    // Crear DB si no existe
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    )
    await conn.query(`USE \`${config.mysql.database}\`;`)

    for (const st of statements) {
      // Omitir CREATE DATABASE / USE del archivo (ya lo hacemos aquí)
      const up = st.toUpperCase()
      if (up.startsWith('CREATE DATABASE')) continue
      if (up.startsWith('USE ')) continue
      await conn.query(st)
    }

    console.log(`OK: esquema creado/validado en BD "${config.mysql.database}".`)
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('db:init error:', e?.message ?? e)
  process.exit(1)
})

