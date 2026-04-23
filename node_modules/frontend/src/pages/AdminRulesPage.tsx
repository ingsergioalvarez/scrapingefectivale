import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  Grid,
} from '@mui/material'
import { useState } from 'react'
import { api } from '../api/client'
import SaveIcon from '@mui/icons-material/Save'
import SyncIcon from '@mui/icons-material/Sync'
import EditIcon from '@mui/icons-material/Edit'

type TopupRule = {
  id: number
  efectivale_account_id: number
  cuenta: string
  alias: string | null
  short_code: number | null
  chofer_id: number | null
  vehiculo_id: number | null
  min_saldo: number
  max_saldo: number
  frecuencia: string | null
  modo_carga: 'COMPLETAR' | 'ACUMULAR' | null
  enabled: boolean
  inactive_reason: string | null
  notes: string | null
  nip: string | null
  chofer_nombre?: string
  vehiculo_placas?: string
  account_alias?: string
  updated_at: string
}

const FRECUENCIAS = [
  'A LIBRE DEMANDA',
  'SEMANAL',
  'QUINCENAL',
  'MENSUAL',
  'EVENTUAL'
]

export function AdminRulesPage() {
  const qc = useQueryClient()
  const [editingRow, setEditingRow] = useState<TopupRule | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['admin-rules'],
    queryFn: async () => {
      const { data } = await api.get<TopupRule[]>('/api/admin/rules')
      return data
    },
  })

  const { data: choferes = [] } = useQuery({
    queryKey: ['choferes'],
    queryFn: async () => {
      const res = await api.get('/api/admin/choferes')
      return res.data
    }
  })

  const { data: vehiculos = [] } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: async () => {
      const res = await api.get('/api/admin/vehiculos')
      return res.data
    }
  })

  const { data: accounts = [] } = useQuery({
    queryKey: ['admin-accounts'],
    queryFn: async () => {
      const res = await api.get('/api/admin/accounts')
      return res.data
    }
  })

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<TopupRule>) => {
      await api.post('/api/admin/rules', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-rules'] })
      setEditingRow(null)
    },
  })

  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/api/admin/rules/seed', {})
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['admin-rules'] })
      alert(`SINCRONIZACIÓN COMPLETADA. SE AÑADIERON ${data.count} REGLAS NUEVAS.`)
    },
  })

  return (
    <Stack spacing={4}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h4">REGLAS DE GASOLINA</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05rem', mt: 0.5 }}>
            CONFIGURACIÓN DE LÍMITES Y POLÍTICAS DE CARGA AUTOMÁTICA
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={seedMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
          onClick={() => seedMutation.mutate()}
        >
          SINCRONIZAR TARJETAS
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>CÓDIGO</TableCell>
              <TableCell>TITULAR / SERIE</TableCell>
              <TableCell>ORIGEN / CUENTA</TableCell>
              <TableCell>FRECUENCIA</TableCell>
              <TableCell>POLÍTICA</TableCell>
              <TableCell>CHOFER</TableCell>
              <TableCell>UNIDAD</TableCell>
              <TableCell align="right">MÍNIMO</TableCell>
              <TableCell align="right">MÁXIMO</TableCell>
              <TableCell>ESTADO</TableCell>
              <TableCell align="right">ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(Array.isArray(rules) ? rules : []).map((r) => (
              <TableRow key={r.id} hover sx={{ opacity: r.enabled ? 1 : 0.6 }}>
                <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>{r.short_code ?? '---'}</TableCell>
                <TableCell>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>{r.alias}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{r.cuenta}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={r.account_alias?.toUpperCase() || 'P/D'} size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: '9px' }} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>{r.frecuencia || 'DEMANDA'}</Typography>
                </TableCell>
                <TableCell>
                  <Tooltip title={r.modo_carga === 'ACUMULAR' ? 'Suma el máximo al saldo actual' : 'Lleva el saldo hasta el nivel máximo'}>
                    <Chip 
                      label={r.modo_carga || 'COMPLETAR'} 
                      size="small" 
                      color={r.modo_carga === 'ACUMULAR' ? 'secondary' : 'default'}
                      sx={{ fontWeight: 900, fontSize: '9px', height: 18 }} 
                    />
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 600 }}>{r.chofer_nombre || '---'}</TableCell>
                <TableCell sx={{ textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 800, color: 'primary.main' }}>{r.vehiculo_placas || '---'}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'error.main' }}>${(r.min_saldo || 0).toLocaleString()}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>${(r.max_saldo || 0).toLocaleString()}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Switch
                      checked={r.enabled}
                      size="small"
                      color="primary"
                      onChange={() => saveMutation.mutate({ ...r, enabled: !r.enabled })}
                    />
                    {!r.enabled && r.inactive_reason && (
                      <Tooltip title={r.inactive_reason}>
                        <Chip label="INAC." color="error" size="small" variant="outlined" sx={{ height: 16, fontSize: '9px', fontWeight: 900 }} />
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => setEditingRow(r)} sx={{ color: 'text.secondary' }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIALOGO DE EDICIÓN: DOS COLUMNAS FORZADAS */}
      <Dialog 
        open={!!editingRow} 
        onClose={() => setEditingRow(null)} 
        fullWidth 
        maxWidth="md" 
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', py: 3 }}>
          CONFIGURACIÓN: {editingRow?.short_code ? `[${editingRow.short_code}]` : ''} {editingRow?.alias?.toUpperCase()}
        </DialogTitle>
        
        <DialogContent dividers sx={{ py: 4 }}>
          <Grid container spacing={3}>
            
            {/* FILA 1 */}
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Cuenta Efectivale (Fondos)
              </Typography>
              <Select
                fullWidth
                value={editingRow?.efectivale_account_id || ''}
                onChange={e => setEditingRow(p => p ? {...p, efectivale_account_id: Number(e.target.value)} : null)}
              >
                {(Array.isArray(accounts) ? accounts : []).map((acc: any) => (
                  <MenuItem key={acc.id} value={acc.id}>{acc.alias?.toUpperCase()}</MenuItem>
                ))}
              </Select>
            </Grid>

            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Alias de la Tarjeta
              </Typography>
              <TextField 
                fullWidth 
                value={editingRow?.alias || ''} 
                onChange={e => setEditingRow(p => p ? {...p, alias: e.target.value.toUpperCase()} : null)}
              />
            </Grid>

            {/* FILA 2 */}
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Chofer Asignado
              </Typography>
              <Select
                fullWidth
                value={editingRow?.chofer_id || ''}
                onChange={e => setEditingRow(p => p ? {...p, chofer_id: e.target.value ? Number(e.target.value) : null} : null)}
              >
                <MenuItem value=""><em>NINGUNO</em></MenuItem>
                {(Array.isArray(choferes) ? choferes : []).map((c: any) => <MenuItem key={c.id} value={c.id}>{c.nombre.toUpperCase()}</MenuItem>)}
              </Select>
            </Grid>

            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Vehículo
              </Typography>
              <Select
                fullWidth
                value={editingRow?.vehiculo_id || ''}
                onChange={e => setEditingRow(p => p ? {...p, vehiculo_id: e.target.value ? Number(e.target.value) : null} : null)}
              >
                <MenuItem value=""><em>NINGUNO</em></MenuItem>
                {(Array.isArray(vehiculos) ? vehiculos : []).map((v: any) => <MenuItem key={v.id} value={v.id}>{v.placas.toUpperCase()}</MenuItem>)}
              </Select>
            </Grid>

            {/* FILA 3 */}
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Frecuencia
              </Typography>
              <Select
                fullWidth
                value={editingRow?.frecuencia || 'A LIBRE DEMANDA'}
                onChange={e => setEditingRow(p => p ? {...p, frecuencia: e.target.value} : null)}
              >
                {FRECUENCIAS.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
              </Select>
            </Grid>

            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'secondary.main', textTransform: 'uppercase' }}>
                Modo de Carga (Política)
              </Typography>
              <Select
                fullWidth
                value={editingRow?.modo_carga || 'COMPLETAR'}
                onChange={e => setEditingRow(p => p ? {...p, modo_carga: e.target.value as any} : null)}
              >
                <MenuItem value="COMPLETAR">COMPLETAR (HASTA EL MÁXIMO)</MenuItem>
                <MenuItem value="ACUMULAR">ACUMULAR (SUMAR MÁXIMO)</MenuItem>
              </Select>
            </Grid>

            <Grid item xs={6}>
               <Stack direction="row" spacing={1} sx={{ mt: 3.5 }}>
                 <Button 
                    fullWidth
                    variant={editingRow?.enabled ? "contained" : "outlined"} 
                    color={editingRow?.enabled ? "primary" : "inherit"}
                    onClick={() => setEditingRow(p => p ? {...p, enabled: true} : null)}
                  >ACTIVA</Button>
                  <Button 
                    fullWidth
                    variant={!editingRow?.enabled ? "contained" : "outlined"} 
                    color={!editingRow?.enabled ? "error" : "inherit"}
                    onClick={() => setEditingRow(p => p ? {...p, enabled: false} : null)}
                  >INACTIVA</Button>
               </Stack>
            </Grid>

            {/* FILA 4: LÍMITES */}
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'error.main', textTransform: 'uppercase' }}>
                Límite Mínimo ($)
              </Typography>
              <TextField 
                type="number" 
                fullWidth 
                value={editingRow?.min_saldo ?? 0}
                onChange={e => setEditingRow(p => p ? {...p, min_saldo: Number(e.target.value)} : null)}
              />
            </Grid>

            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'success.main', textTransform: 'uppercase' }}>
                Límite Máximo ($)
              </Typography>
              <TextField 
                type="number" 
                fullWidth 
                value={editingRow?.max_saldo ?? 0}
                onChange={e => setEditingRow(p => p ? {...p, max_saldo: Number(e.target.value)} : null)}
              />
            </Grid>

            {/* FILA 5: NIP Y NOTAS */}
            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                NIP de la Tarjeta
              </Typography>
              <TextField 
                fullWidth 
                value={editingRow?.nip || ''} 
                onChange={e => setEditingRow(p => p ? {...p, nip: e.target.value} : null)}
                inputProps={{ maxLength: 10 }}
              />
            </Grid>

            <Grid item xs={6}>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Notas
              </Typography>
              <TextField 
                fullWidth 
                value={editingRow?.notes || ''} 
                onChange={e => setEditingRow(p => p ? {...p, notes: e.target.value} : null)}
              />
            </Grid>

            {/* FILA 6: MOTIVO */}
            {!editingRow?.enabled && (
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'error.main', textTransform: 'uppercase' }}>
                  Motivo de Inactivación
                </Typography>
                <TextField 
                  fullWidth 
                  multiline 
                  rows={2}
                  value={editingRow?.inactive_reason || ''} 
                  onChange={e => setEditingRow(p => p ? {...p, inactive_reason: e.target.value.toUpperCase()} : null)}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setEditingRow(null)} color="inherit">CANCELAR</Button>
          <Box sx={{ flex: 1 }} />
          <Button 
            variant="contained" 
            startIcon={<SaveIcon />}
            onClick={() => editingRow && saveMutation.mutate(editingRow)}
            sx={{ fontWeight: 800, px: 4 }}
          >
            GUARDAR CAMBIOS
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
