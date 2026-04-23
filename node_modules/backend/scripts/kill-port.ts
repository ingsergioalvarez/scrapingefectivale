import { execSync } from 'node:child_process'

/**
 * Script para matar procesos en un puerto específico (Windows safe).
 * Se usa para evitar errores de EADDRINUSE y conflictos de polling de Telegram.
 */

const port = process.env.PORT || '4000'

function killPort(p: string) {
  console.log(`[kill-port] Revisando puerto ${p}...`)

  try {
    // netstat -ano devuelve: Proto  Local Address  Foreign Address  State  PID
    // findstr filtra por el puerto exacto (ej :4000)
    const result = execSync(`netstat -ano | findstr :${p}`).toString()
    const lines = result.trim().split('\n')
    const pids = new Set<string>()

    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      // Validamos que sea un número y no sea 0 (system process)
      if (pid && pid !== '0' && /^\d+$/.test(pid)) {
        pids.add(pid)
      }
    }

    if (pids.size === 0) {
      console.log(`[kill-port] Puerto ${p} está libre.`)
      return
    }

    for (const pid of pids) {
      console.log(`[kill-port] Intentando matar proceso con PID ${pid} que usa el puerto ${p}...`)
      try {
        // /F = Force, /T = Tree (cierra hijos)
        execSync(`taskkill /F /PID ${pid} /T`)
        console.log(`[kill-port] Proceso ${pid} terminado exitosamente.`)
      } catch (err: any) {
        // A veces el proceso ya se cerró o no tenemos permisos
        console.warn(`[kill-port] Warning: No se pudo terminar el PID ${pid}: ${err.message}`)
      }
    }
  } catch (e: any) {
    // Si findstr no encuentra coincidencias, sale con error code, lo cual es normal si el puerto está libre
    if (e.status === 1) {
      console.log(`[kill-port] Puerto ${p} está libre.`)
    } else {
      console.error(`[kill-port] Error al ejecutar netstat: ${e.message}`)
    }
  }
}

killPort(port)
