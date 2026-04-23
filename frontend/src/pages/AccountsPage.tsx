import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
  Grid,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

type AppAccount = {
  id: number
  app: 'efectivale'
  alias: string | null
  username: string
  notes: string | null
  hasSession: boolean
}

export function AccountsPage() {
  const qc = useQueryClient()

  const [alias, setAlias] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [efCliente, setEfCliente] = useState('')
  const [efConsignatario, setEfConsignatario] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const accountsQ = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const r = await api.get<AppAccount[]>('/api/accounts')
      return r.data
    },
  })

  const createM = useMutation({
    mutationFn: async () => {
      setError(null)
      await api.post('/api/accounts', {
        alias: alias.trim() ? alias.trim() : undefined,
        username: username.trim(),
        password,
        notes: notes.trim() ? notes.trim() : undefined,
        extra: { clienteId: efCliente.trim(), consignatarioId: efConsignatario.trim() },
      })
    },
    onSuccess: async () => {
      setAlias('')
      setUsername('')
      setPassword('')
      setEfCliente('')
      setEfConsignatario('')
      setNotes('')
      await qc.invalidateQueries({ queryKey: ['accounts'] })
    },
    onError: (e: any) => setError(e?.response?.data?.error ? JSON.stringify(e.response.data.error) : e?.message ?? String(e)),
  })

  const deleteM = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/accounts/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const rows = useMemo(() => accountsQ.data ?? [], [accountsQ.data])

  return (
    <Stack spacing={4}>
      <Box>
        <Typography variant="h4">ACCESOS A PLATAFORMAS</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05rem', mt: 0.5 }}>
          GESTIÓN CENTRALIZADA DE CREDENCIALES Y SERVICIOS EXTERNOS
        </Typography>
      </Box>

      {error ? <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>{error}</Alert> : null}

      <Card sx={{ p: 2 }}>
        <CardContent>
          <Stack spacing={4}>
            <Typography variant="h6" color="primary" sx={{ fontWeight: 800 }}>
              NUEVA CREDENCIAL DE ACCESO
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField 
                  fullWidth label="ALIAS DE IDENTIFICACIÓN (EJ: CUENTA PRINCIPAL)" 
                  value={alias} onChange={(e) => setAlias(e.target.value.toUpperCase())}
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="USUARIO" value={username} onChange={(e) => setUsername(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="CONTRASEÑA"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField fullWidth label="CLIENTE ID (EFECTIVALE)" value={efCliente} onChange={(e) => setEfCliente(e.target.value)} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="CONSIGNATARIO ID (EFECTIVALE)" value={efConsignatario} onChange={(e) => setEfConsignatario(e.target.value)} />
              </Grid>

              <Grid item xs={12}>
                <TextField fullWidth multiline minRows={3} label="NOTAS PRIVADAS / BITÁCORA" value={notes} onChange={(e) => setNotes(e.target.value.toUpperCase())} />
              </Grid>
            </Grid>
            
            <Box>
              <Button 
                variant="contained" 
                size="large"
                onClick={() => createM.mutate()} 
                disabled={createM.isPending}
                sx={{ px: 6 }}
              >
                {createM.isPending ? 'GUARDANDO...' : 'REGISTRAR ACCESO'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 3, fontWeight: 800 }}>
          CUENTAS ACTIVAS EN EL SISTEMA
        </Typography>
        <Grid container spacing={2}>
          {rows.map((a) => (
            <Grid item xs={12} key={a.id}>
              <Card sx={{ p: 1, border: '1px solid rgba(0,0,0,0.05)' }}>
                <CardContent sx={{ py: '12px !important', px: 3 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={3} alignItems="center">
                      <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(37, 99, 235, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ color: 'primary.main', fontWeight: 900, fontSize: '1.2rem' }}>{a.app[0].toUpperCase()}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, textTransform: 'uppercase' }}>{a.alias || a.username}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{a.username}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={3} alignItems="center">
                      {a.hasSession && <Chip label="SESIÓN ACTIVA" size="small" variant="outlined" color="success" sx={{ fontWeight: 900, fontSize: '10px' }} />}
                      <Button color="error" size="small" onClick={() => deleteM.mutate(a.id)} sx={{ fontWeight: 700 }}>
                        ELIMINAR
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {rows.length === 0 && (
            <Grid item xs={12}>
              <Typography sx={{ color: 'text.disabled', fontStyle: 'italic', textAlign: 'center', py: 4, bgcolor: '#f8fafc', borderRadius: 2 }}>
                NO SE HAN REGISTRADO CUENTAS DE ACCESO
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>
    </Stack>
  )
}
