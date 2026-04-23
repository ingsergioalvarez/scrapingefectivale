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
  const sqlFiles = [
    path.resolve('sql', 'init.sql'),
    path.resolve('database', 'config_initdb.sql')
  ];

  // 1) Conectar sin DB para poder crearla si no existe
  const conn = await mysql.createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
  })

  try {
    // Asegurar que la DB existe antes de nada
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    )
    await conn.query(`USE \`${config.mysql.database}\`;`)

    for (const sqlPath of sqlFiles) {
      if (!fs.existsSync(sqlPath)) continue;
      
      console.log(`Ejecutando: ${path.basename(sqlPath)}...`);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      const statements = splitSqlStatements(sql);

      for (const st of statements) {
        // Omitir comandos de creación de DB/USE si vienen dentro del archivo (ya lo manejamos arriba)
        const up = st.toUpperCase();
        if (up.startsWith('CREATE DATABASE')) continue;
        if (up.startsWith('USE ')) continue;
        await conn.query(st);
      }
    }

    console.log(`OK: esquema base y de seguridad creados/validados en BD "${config.mysql.database}".`);
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('db:init error:', e?.message ?? e)
  process.exit(1)
})

