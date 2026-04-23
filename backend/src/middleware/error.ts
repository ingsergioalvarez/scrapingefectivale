import type { ErrorRequestHandler } from 'express'

export const errorMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  const msg = err?.message ?? String(err)

  if (msg.includes('ENCRYPTION_KEY_BASE64')) {
    return res.status(500).json({
      error:
        'No se pudo cargar la clave de cifrado. Configura ENCRYPTION_KEY_BASE64 en el .env (recomendado) o borra/crea server/data/encryption-key.base64',
      detail: msg,
    })
  }

  return res.status(500).json({ error: 'Error interno', detail: msg })
}

