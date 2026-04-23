import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { DataGrid, GridToolbar } from '@mui/x-data-grid'
import type { GridColDef } from '@mui/x-data-grid'

type AppAccount = {
  id: number
  app: 'efectivale'
  alias: string | null
  username: string
  hasSession: boolean
}

type Row = {
  cuenta: string
  tarjeta: string
  empleado: string
  usuarioParametros: string
  saldo: number | null
}

type GridRow = Row & { id: string }

export function EfectivaleEmpleadosPage() {
  const [accountId, setAccountId] = useState<number | ''>('')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [scrapedAt, setScrapedAt] = useState<string | null>(null)
  const [debug, setDebug] = useState(true)
  const [logs, setLogs] = useState<string[] | null>(null)

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => (await api.get<AppAccount[]>('/api/accounts')).data,
  })

  const efectivaleAccounts = useMemo(
    () => (accountsQ.data ?? []).filter((a) => a.app === 'efectivale'),
    [accountsQ.data]
  )

  const scrapeM = useMutation({
    mutationFn: async () => {
      if (typeof accountId !== 'number') throw new Error('Selecciona una cuenta')
      const r = await api.post<{ ok: boolean; rows: Row[]; scrapedAt: string; logs?: string[] }>(
        '/api/scrape/efectivale/empleados',
        { accountId, debug }
      )
      return r.data
    },
    onSuccess: (d) => {
      setRows(d.rows)
      setScrapedAt(d.scrapedAt)
      setLogs(d.logs ?? null)
    },
  })

  const filtered = useMemo(() => {
    const base = rows ?? []
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter((r) => {
      const hay = [
        r.cuenta,
        r.tarjeta,
        r.empleado,
        r.usuarioParametros,
        r.saldo === null ? '' : String(r.saldo),
      ]
        .join(' | ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  const totalSaldo = useMemo(() => filtered.reduce((acc, r) => acc + (r.saldo ?? 0), 0), [filtered])

  const gridRows = useMemo<GridRow[]>(
    () => filtered.map((r, idx) => ({ id: `${r.cuenta}-${r.tarjeta}-${idx}`, ...r })),
    [filtered]
  )

  const columns = useMemo<GridColDef<GridRow>[]>(
    () => [
      { field: 'cuenta', headerName: 'Cuenta', minWidth: 120, flex: 0.6 },
      { field: 'tarjeta', headerName: 'Tarjeta', minWidth: 120, flex: 0.6 },
      { field: 'empleado', headerName: 'Empleado', minWidth: 240, flex: 1.2 },
      { field: 'usuarioParametros', headerName: 'Usuario Parametros', minWidth: 220, flex: 1 },
      {
        field: 'saldo',
        headerName: 'Saldo',
        type: 'number',
        minWidth: 120,
        flex: 0.6,
        renderCell: (p) => {
          const v = (p.row as any).saldo
          return v === null || v === undefined ? '' : `$${Number(v).toFixed(2)}`
        },
      },
    ],
    []
  )

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Efectivale · Lista de Empleados</Typography>

      <Alert severity="info">
        Se usa tu cuenta Efectivale (Cliente/Consignatario/Usuario/Contraseña) para entrar y leer la tabla paginada
        completa.
      </Alert>

      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <FormControl fullWidth>
              <InputLabel id="account">Cuenta Efectivale</InputLabel>
              <Select
                labelId="account"
                label="Cuenta Efectivale"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value as any)}
              >
                {efectivaleAccounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.alias ? `${a.alias} · ` : ''}
                    {a.username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Button
                variant="contained"
                onClick={() => scrapeM.mutate()}
                disabled={scrapeM.isPending || typeof accountId !== 'number'}
              >
                Ejecutar scraping (Empleados)
              </Button>
            </Box>

            <Alert severity="warning">
              Modo pruebas: {debug ? <b>ON</b> : <b>OFF</b>} (abre navegador y loggea pasos).
              <Box sx={{ mt: 1 }}>
                <Button variant="outlined" onClick={() => setDebug((v) => !v)}>
                  {debug ? 'Desactivar debug' : 'Activar debug'}
                </Button>
              </Box>
            </Alert>

            {scrapeM.error ? (
              <Alert severity="error">
                {String(
                  (scrapeM.error as any)?.response?.data?.error ??
                    (scrapeM.error as any)?.message ??
                    scrapeM.error
                )}
              </Alert>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {rows?.length ? (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  Registros ({filtered.length})
                  {scrapedAt ? ` · ${new Date(scrapedAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}` : ''}
                  {` · Saldo total: $${totalSaldo.toFixed(2)}`}
                </Typography>
                <TextField size="small" label="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
              </Stack>

              <Box sx={{ height: 520, width: '100%' }}>
                <DataGrid
                  rows={gridRows}
                  columns={columns}
                  disableRowSelectionOnClick
                  initialState={{
                    pagination: { paginationModel: { pageSize: 50, page: 0 } },
                    sorting: { sortModel: [{ field: 'saldo', sort: 'desc' }] },
                  }}
                  pageSizeOptions={[10, 25, 50, 100]}
                  slots={{ toolbar: GridToolbar }}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {logs?.length ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Logs de scraping (backend)
            </Typography>
            <Box component="pre" sx={{ m: 0, fontSize: 12, overflow: 'auto', maxHeight: 260 }}>
              {logs.join('\n')}
            </Box>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  )
}

