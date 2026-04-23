import ExcelJS from 'exceljs'
import path from 'node:path'
import { pool } from '../db'
import nodemailer from 'nodemailer'

/**
 * Genera un reporte Excel basado en el último barrido de saldos de MySQL.
 */
export async function buildEfectivaleGasolinaReporteXlsx() {
  const [rows]: any = await pool.query(`
    SELECT cuenta, tarjeta, empleado, origen_label AS origenLabel, saldo, scraped_at AS scrapedAt
    FROM efectivale_saldo_rows
    ORDER BY empleado ASC, origen_label ASC
  `)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Saldos Efectivale')

  ws.columns = [
    { header: 'Cuenta', key: 'cuenta', width: 15 },
    { header: 'Tarjeta', key: 'tarjeta', width: 22 },
    { header: 'Empleado / Unidad', key: 'empleado', width: 40 },
    { header: 'Origen', key: 'origenLabel', width: 25 },
    { header: 'Saldo', key: 'saldo', width: 14, style: { numFmt: '"$"#,##0.00' } },
    { header: 'Actualizado el', key: 'scrapedAt', width: 20 },
  ]

  let totalSaldo = 0
  for (const r of rows) {
    const s = Number(r.saldo ?? 0)
    totalSaldo += s
    ws.addRow({
      ...r,
      saldo: s,
      scrapedAt: new Date(r.scrapedAt).toLocaleString(),
    })
  }

  // Fila de total
  ws.addRow({})
  const totalRow = ws.addRow({ empleado: 'TOTAL:', saldo: totalSaldo })
  totalRow.getCell('empleado').font = { bold: true }
  totalRow.getCell('saldo').font = { bold: true }

  const filename = `Reporte_Gasolina_${new Date().toISOString().split('T')[0]}.xlsx`
  const filePath = path.resolve(__dirname, '..', '..', 'data', 'reports', filename)
  
  const fs = await import('node:fs')
  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  await wb.xlsx.writeFile(filePath)
  return { filePath, totalSaldo, rowCount: rows.length }
}

/**
 * Envía el reporte por correo si está configurado el SMTP.
 */
export async function maybeEmailReport(attachmentPath: string, subject: string) {
  const {
    REPORT_SMTP_HOST,
    REPORT_SMTP_PORT,
    REPORT_SMTP_USER,
    REPORT_SMTP_PASS,
    REPORT_SMTP_FROM,
    REPORT_SMTP_TO
  } = process.env

  if (!REPORT_SMTP_HOST || !REPORT_SMTP_TO) {
    return { emailed: false, reason: 'SMTP no configurado' }
  }

  const transporter = nodemailer.createTransport({
    host: REPORT_SMTP_HOST,
    port: Number(REPORT_SMTP_PORT || 587),
    secure: process.env.REPORT_SMTP_SECURE === 'true',
    auth: {
      user: REPORT_SMTP_USER,
      pass: REPORT_SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: REPORT_SMTP_FROM || REPORT_SMTP_USER,
    to: REPORT_SMTP_TO,
    subject,
    text: `Se adjunta el reporte generado automáticamente.\nFecha: ${new Date().toLocaleString()}`,
    attachments: [
      {
        filename: path.basename(attachmentPath),
        path: attachmentPath,
      },
    ],
  })

  return { emailed: true, to: REPORT_SMTP_TO }
}
