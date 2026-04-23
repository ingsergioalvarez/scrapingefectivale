import fs from 'node:fs'
import path from 'node:path'

const sqlPath = path.resolve('sql', 'init.sql')
process.stdout.write(fs.readFileSync(sqlPath, 'utf8'))

