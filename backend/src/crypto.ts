import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config'

type EncryptedPayload = {
  v: 1
  iv: string
  tag: string
  data: string
}

function getKey(): Buffer {
  // 1) Preferimos .env (estático)
  const rawEnv = (config.encryptionKeyBase64 ?? '').trim()
  if (rawEnv && rawEnv !== 'REPLACE_ME') {
    const key = Buffer.from(rawEnv, 'base64')
    if (key.length === 32) return key
  }

  // 2) Fallback: clave persistente en archivo (se crea 1 sola vez)
  const serverRoot = path.resolve(__dirname, '..')
  const keyFile = path.join(serverRoot, 'data', 'encryption-key.base64')
  try {
    if (fs.existsSync(keyFile)) {
      const raw = fs.readFileSync(keyFile, 'utf8').trim()
      const key = Buffer.from(raw, 'base64')
      if (key.length === 32) return key
    }
  } catch {
    // ignore
  }

  fs.mkdirSync(path.dirname(keyFile), { recursive: true })
  const raw = crypto.randomBytes(32).toString('base64')
  fs.writeFileSync(keyFile, raw, 'utf8')
  return Buffer.from(raw, 'base64')
}

export function encryptString(plain: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload: EncryptedPayload = {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
}

export function decryptString(ciphertextBase64: string): string {
  const key = getKey()
  const decoded = Buffer.from(ciphertextBase64, 'base64').toString('utf8')
  const payload = JSON.parse(decoded) as EncryptedPayload
  if (!payload || payload.v !== 1) throw new Error('Formato de cifrado no soportado')

  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const data = Buffer.from(payload.data, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(data), decipher.final()])
  return plain.toString('utf8')
}

