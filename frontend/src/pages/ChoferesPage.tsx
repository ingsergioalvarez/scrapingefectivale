import React, { useState } from 'react'
import {
  Box,
  Typography,
  Stack,
  TextField,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  Grid,
} from '@mui/material'
import {
  Edit as EditIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
  DirectionsCar as CarIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const tableCellStyle = {
  textTransform: 'uppercase',
  fontSize: '0.8rem',
  letterSpacing: '0.05rem',
  fontWeight: 500,
}

export const ChoferesPage: React.FC = () => {
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false)
  const [editingChofer, setEditingChofer] = useState<any | null>(null)
  const [assigningChofer, setAssigningChofer] = useState<any | null>(null)
  const [historyUser, setHistoryUser] = useState<any | null>(null)
  
  const [formName, setFormName] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<string | number>('')
  const [selectedCard, setSelectedCard] = useState('')

  const queryClient = useQueryClient()

  // DATA FETCHING
  const { data: choferes = [], isLoading } = useQuery({
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

  const { data: rules = [] } = useQuery({
    queryKey: ['rules'],
    queryFn: async () => {
      const res = await api.get('/api/admin/rules')
      return res.data
    }
  })

  const { data: history = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chofer-history', historyUser?.id],
    queryFn: async () => {
      const res = await api.get(`/api/admin/choferes/${historyUser.id}/history`)
      return res.data
    },
    enabled: !!historyUser
  })

  // MUTATIONS
  const createM = useMutation({
    mutationFn: (name: string) => api.post('/api/admin/choferes', { nombre: name }),
    onSuccess: () => {
      setIsNewDialogOpen(false)
      setFormName('')
      queryClient.invalidateQueries({ queryKey: ['choferes'] })
    }
  })

  const updateM = useMutation({
    mutationFn: (data: { id: number, nombre: string }) => api.put(`/api/admin/choferes/${data.id}`, { nombre: data.nombre }),
    onSuccess: () => {
      setEditingChofer(null)
      queryClient.invalidateQueries({ queryKey: ['choferes'] })
    }
  })

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/choferes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['choferes'] })
  })

  const assignM = useMutation({
    mutationFn: (data: { choferId: number, vehiculoId: number | null, cuenta: string | null }) => 
      api.put(`/api/admin/choferes/${data.choferId}/assets`, { vehiculo_id: data.vehiculoId, cuenta: data.cuenta }),
    onSuccess: () => {
      setAssignAssigningChofer(null)
      queryClient.invalidateQueries({ queryKey: ['choferes'] })
      queryClient.invalidateQueries({ queryKey: ['rules'] })
    }
  })

  const setAssignAssigningChofer = (val: any) => setAssigningChofer(val)

  if (isLoading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h4">GESTIÓN DE CHOFERES</Typography>
          <Typography color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', mt: 0.5 }}>
            ADMINISTRACIÓN DE PERSONAL Y ASIGNACIÓN DE ACTIVOS
          </Typography>
        </Box>
        <Button
          variant="contained"
          fullWidth={{ xs: true, sm: false }}
          startIcon={<AddIcon />}
          onClick={() => { setFormName(''); setIsNewDialogOpen(true); }}
        >
          REGISTRAR NUEVO CHOFER
        </Button>
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>NOMBRE COMPLETO</TableCell>
              <TableCell>VEHÍCULO</TableCell>
              <TableCell>TARJETA</TableCell>
              <TableCell>ESTADO</TableCell>
              <TableCell align="right">ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {choferes.map((c: any) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ ...tableCellStyle, fontWeight: 700 }}>{c.nombre?.toUpperCase()}</TableCell>
                <TableCell sx={tableCellStyle}>{c.vehiculos?.toUpperCase() || '---'}</TableCell>
                <TableCell sx={tableCellStyle}>{c.tarjetas?.toUpperCase() || '---'}</TableCell>
                <TableCell>
                  <Chip 
                    label="ACTIVO" 
                    size="small" 
                    variant="outlined"
                    color="primary"
                    sx={{ fontSize: '0.65rem', fontWeight: 800 }} 
                  />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Tooltip title="EDITAR">
                      <IconButton size="small" onClick={() => { setEditingChofer(c); setFormName(c.nombre); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="ASIGNAR ACTIVOS">
                      <IconButton size="small" color="primary" onClick={() => { setAssigningChofer(c); setSelectedVehicle(c.vehiculo_id || ''); setSelectedCard(c.tarjeta_cuenta || ''); }}>
                        <CarIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="INACTIVAR">
                      <IconButton size="small" color="error" onClick={() => { if(confirm('¿Inactivar chofer?')) deleteM.mutate(c.id) }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIALOG: NUEVO/EDITAR CHOFER (VERTICAL) */}
      <Dialog 
        open={isNewDialogOpen || !!editingChofer} 
        onClose={() => { setIsNewDialogOpen(false); setEditingChofer(null); }} 
        fullWidth 
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', py: 3 }}>
          {editingChofer ? 'EDITAR CHOFER' : 'NUEVO CHOFER'}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Nombre Completo del Operador
              </Typography>
              <TextField
                fullWidth
                placeholder="EJ. JUAN PÉREZ"
                value={formName}
                onChange={(e) => setFormName(e.target.value.toUpperCase())}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => { setIsNewDialogOpen(false); setEditingChofer(null); }} color="inherit">CANCELAR</Button>
          <Button 
            variant="contained" 
            onClick={() => editingChofer ? updateM.mutate({ id: editingChofer.id, nombre: formName }) : createM.mutate(formName)}
            disabled={!formName}
            sx={{ fontWeight: 800, px: 4 }}
          >
            GUARDAR
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: ASIGNAR ACTIVOS (VERTICAL) */}
      <Dialog open={!!assigningChofer} onClose={() => setAssignAssigningChofer(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', py: 3 }}>
          ASIGNACIÓN: {assigningChofer?.nombre?.toUpperCase()}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 4 }}>
          <Stack spacing={4}>
            <FormControl fullWidth>
              <Typography variant="caption" sx={{ mb: 1, fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Unidad / Vehículo
              </Typography>
              <Select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
              >
                <MenuItem value=""><em>NINGUNO</em></MenuItem>
                {vehiculos.map((v: any) => <MenuItem key={v.id} value={v.id}>{v.placas.toUpperCase()} - {v.modelo?.toUpperCase()}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <Typography variant="caption" sx={{ mb: 1, fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Plástico de Gasolina (Regla)
              </Typography>
              <Select
                value={selectedCard}
                onChange={(e) => setSelectedCard(e.target.value)}
              >
                <MenuItem value=""><em>DESVINCULAR</em></MenuItem>
                {rules
                  .filter((r: any) => !r.chofer_id || r.chofer_id === assigningChofer?.id)
                  .map((r: any) => (
                    <MenuItem key={r.cuenta} value={r.cuenta}>
                      {r.short_code} - {r.alias?.toUpperCase()}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, justifyContent: 'space-between' }}>
          <Button onClick={() => setAssignAssigningChofer(null)} color="inherit">CANCELAR</Button>
          <Button 
            variant="contained"
            sx={{ fontWeight: 800, px: 4 }}
            onClick={() => assignM.mutate({ 
              choferId: assigningChofer.id, 
              vehiculoId: selectedVehicle ? Number(selectedVehicle) : null,
              cuenta: selectedCard || null
            })}
          >
            CONFIRMAR
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
