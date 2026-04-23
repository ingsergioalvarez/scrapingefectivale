import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'

function loadDotenv() {
  const explicit = process.env.DOTENV_PATH
  const candidates = [
    explicit,
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p })
        return
      }
    } catch {
      // ignore
    }
  }

  dotenv.config()
}

loadDotenv()

export const config = {
  port: Number(process.env.APP_PORT ?? 4000),
  mysql: {
    host: process.env.MYSQL_HOST ?? 'localhost',
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? 'root',
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE ?? 'ControlVehicular',
  },
  encryptionKeyBase64: process.env.ENCRYPTION_KEY_BASE64 ?? '',
  playwrightHeadless: (process.env.PLAYWRIGHT_HEADLESS ?? 'true').toLowerCase() !== 'false',
  telegramAdminChatIds: (process.env.TELEGRAM_ADMIN_CHAT_ID ?? '')
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
} as const;

console.log(`[config] MySQL Database: ${config.mysql.database}`);

