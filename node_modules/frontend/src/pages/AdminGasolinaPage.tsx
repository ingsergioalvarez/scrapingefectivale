import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { api } from '../api/client'

const STORAGE_KEY = 'adminApiKey'

type GasolinaRow = {
  id: string
  telegram_chat_id: number
  solicitante_name: string | null
  id_tipo: 'cuenta' | 'tarjeta'
  cuenta: string | null
  tarjeta_ultimos7: string | null
  tipo_carga: string | null
  actividad: string | null
  monto: number
  status: string
  created_at: string
}

export function AdminGasolinaPage() {
  const qc = useQueryClient()
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(STORAGE_KEY) ?? '')
  const [note, setNote] = useState('')

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, adminKey)
  }, [adminKey])

  const list = useQuery({
    queryKey: ['admin-gasolina', adminKey],
    enabled: !!adminKey.trim(),
    queryFn: async () => {
      const { data } = await api.get<GasolinaRow[]>('/api/admin/gasolina', {
        params: { status: 'pending' },
        headers: { 'x-admin-key': adminKey.trim() },
      })
      return data
    },
  })

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await api.post(
        `/api/admin/gasolina/${id}/approve`,
        { note: note.trim() || undefined },
        { headers: { 'x-admin-key': adminKey.trim() } }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gasolina'] })
      setNote('')
    },
  })

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await api.post(
        `/api/admin/gasolina/${id}/reject`,
        { note: note.trim() || undefined },
        { headers: { 'x-admin-key': adminKey.trim() } }
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-gasolina'] })
      setNote('')
    },
  })

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Administración — solicitudes de gasolina (Telegram)</Typography>
      <Alert severity="info">
        Configura <code>ADMIN_API_KEY</code> en el servidor y pega la misma clave aquí. Las solicitudes aprobadas ejecutan el scraping de dispersión y
        notifican al usuario por Telegram.
      </Alert>
      <TextField
        label="Clave de administrador"
        type="password"
        value={adminKey}
        onChange={(e) => setAdminKey(e.target.value)}
        fullWidth
      />
      <TextField label="Nota opcional (aprobación / rechazo)" value={note} onChange={(e) => setNote(e.target.value)} fullWidth />

      {list.isError && <Alert severity="error">{(list.error as Error).message}</Alert>}

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Solicitante</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Cuenta / Tarjeta</TableCell>
              <TableCell>Carga</TableCell>
              <TableCell>Actividad</TableCell>
              <TableCell align="right">Monto</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(list.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.created_at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}</TableCell>
                <TableCell>{r.solicitante_name ?? '—'}</TableCell>
                <TableCell>{r.id_tipo}</TableCell>
                <TableCell>
                  {r.id_tipo === 'cuenta' ? r.cuenta : `…${r.tarjeta_ultimos7}`}
                </TableCell>
                <TableCell>{r.tipo_carga}</TableCell>
                <TableCell sx={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.actividad}
                </TableCell>
                <TableCell align="right">${r.monto.toFixed(2)}</TableCell>
                <TableCell align="right">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      color="success"
                      variant="contained"
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(r.id)}
                    >
                      Autorizar
                    </Button>
                    <Button size="small" color="error" variant="outlined" disabled={reject.isPending} onClick={() => reject.mutate(r.id)}>
                      Rechazar
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {list.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography color="text.secondary">No hay solicitudes pendientes.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  )
}
