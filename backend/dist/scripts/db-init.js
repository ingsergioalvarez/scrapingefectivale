"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("../src/config");
function splitSqlStatements(sql) {
    // Muy simple: funciona para nuestro init.sql (sin ; dentro de strings).
    return sql
        .split(/;\s*[\r\n]+/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}
async function main() {
    const sqlPath = node_path_1.default.resolve('sql', 'init.sql');
    const sql = node_fs_1.default.readFileSync(sqlPath, 'utf8');
    const statements = splitSqlStatements(sql);
    // 1) Conectar sin DB para poder crearla si no existe
    const conn = await promise_1.default.createConnection({
        host: config_1.config.mysql.host,
        port: config_1.config.mysql.port,
        user: config_1.config.mysql.user,
        password: config_1.config.mysql.password,
        multipleStatements: true,
    });
    try {
        // Crear DB si no existe
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config_1.config.mysql.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await conn.query(`USE \`${config_1.config.mysql.database}\`;`);
        for (const st of statements) {
            // Omitir CREATE DATABASE / USE del archivo (ya lo hacemos aquí)
            const up = st.toUpperCase();
            if (up.startsWith('CREATE DATABASE'))
                continue;
            if (up.startsWith('USE '))
                continue;
            await conn.query(st);
        }
        console.log(`OK: esquema creado/validado en BD "${config_1.config.mysql.database}".`);
    }
    finally {
        await conn.end();
    }
}
main().catch((e) => {
    console.error('db:init error:', e?.message ?? e);
    process.exit(1);
});
