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
} from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const tableCellStyle = {
  textTransform: 'uppercase',
  fontSize: '0.8rem',
  letterSpacing: '0.05rem',
  fontWeight: 500,
}

export const VehiculosPage: React.FC = () => {
  const { hasPermission } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingVehiculo, setEditingVehiculo] = useState<any | null>(null)
  const [formData, setFormData] = useState({ placas: '', modelo: '', anio: '', grupo_id: '' as any })

  const queryClient = useQueryClient()

  // DATA FETCHING
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get('/api/identity/groups')
      return res.data
    }
  })

  const { data: vehiculos = [], isLoading } = useQuery({
    queryKey: ['vehiculos'],
    queryFn: async () => {
      const res = await api.get('/api/admin/vehiculos')
      return res.data
    }
  })

  const createM = useMutation({
    mutationFn: (data: any) => api.post('/api/admin/vehiculos', data),
    onSuccess: () => {
      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] })
    }
  })

  const updateM = useMutation({
    mutationFn: (data: any) => api.put(`/api/admin/vehiculos/${data.id}`, data),
    onSuccess: () => {
      setIsDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['vehiculos'] })
    }
  })

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/vehiculos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehiculos'] })
  })

  const handleEdit = (v: any) => {
    setEditingVehiculo(v)
    setFormData({ 
      placas: v.placas, 
      modelo: v.modelo || '', 
      anio: v.anio ? String(v.anio) : '',
      grupo_id: v.grupo_id || ''
    })
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingVehiculo(null)
    setFormData({ placas: '', modelo: '', anio: '', grupo_id: '' })
    setIsDialogOpen(true)
  }

  if (isLoading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h4">GESTIÓN DE VEHÍCULOS</Typography>
          <Typography color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', mt: 0.5 }}>
            ADMINISTRACIÓN DE LA FLOTA Y UNIDADES OPERATIVAS
          </Typography>
        </Box>
        {hasPermission('VEHICULOS_CREAR') && (
          <Button
            variant="contained"
            fullWidth={{ xs: true, sm: false }}
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            REGISTRAR VEHÍCULO
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>PLACAS</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>GRUPO</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>MODELO / DESCRIPCIÓN</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>AÑO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vehiculos.map((v: any) => (
              <TableRow key={v.id} hover>
                <TableCell sx={{ ...tableCellStyle, fontWeight: 800, color: 'primary.main' }}>{v.placas.toUpperCase()}</TableCell>
                <TableCell sx={tableCellStyle}>
                  {v.grupo_nombre ? <Chip label={v.grupo_nombre} size="small" color="success" variant="outlined" sx={{ fontSize: '10px', fontWeight: 800 }} /> : '---'}
                </TableCell>
                <TableCell sx={{ ...tableCellStyle, fontWeight: 600 }}>{v.modelo?.toUpperCase() || '---'}</TableCell>
                <TableCell sx={tableCellStyle}>{v.anio || '---'}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    {hasPermission('VEHICULOS_EDITAR') && (
                      <Tooltip title="EDITAR">
                        <IconButton size="small" onClick={() => handleEdit(v)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {hasPermission('VEHICULOS_ELIMINAR') && (
                      <Tooltip title="INACTIVAR">
                        <IconButton size="small" color="error" onClick={() => { if(confirm('¿Eliminar vehículo?')) deleteM.mutate(v.id) }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIALOG DE VEHÍCULO (VERTICAL) */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', py: 3 }}>
          {editingVehiculo ? 'EDITAR UNIDAD' : 'NUEVO VEHÍCULO'}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Número de Placas
              </Typography>
              <TextField
                fullWidth
                placeholder="EJ. ABC-123-D"
                value={formData.placas}
                onChange={(e) => setFormData({ ...formData, placas: e.target.value.toUpperCase() })}
              />
            </Box>

            <FormControl fullWidth>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Grupo Logístico
              </Typography>
              <Select
                value={formData.grupo_id}
                onChange={(e) => setFormData({ ...formData, grupo_id: e.target.value })}
              >
                <MenuItem value=""><em>SIN GRUPO (GENERAL)</em></MenuItem>
                {groups.map((g: any) => (
                  <MenuItem key={g.id} value={g.id}>{g.nombre?.toUpperCase()}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Modelo / Marca
              </Typography>
              <TextField
                fullWidth
                placeholder="EJ. NISSAN TSURU"
                value={formData.modelo}
                onChange={(e) => setFormData({ ...formData, modelo: e.target.value.toUpperCase() })}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ mb: 1, display: 'block', fontWeight: 800, color: 'primary.main', textTransform: 'uppercase' }}>
                Año / Modelo
              </Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="EJ. 2023"
                value={formData.anio}
                onChange={(e) => setFormData({ ...formData, anio: e.target.value })}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setIsDialogOpen(false)} color="inherit">CANCELAR</Button>
          <Button 
            variant="contained" 
            sx={{ fontWeight: 800, px: 4 }}
            onClick={() => editingVehiculo 
              ? updateM.mutate({ ...formData, id: editingVehiculo.id, grupo_id: formData.grupo_id || null }) 
              : createM.mutate({ ...formData, grupo_id: formData.grupo_id || null })
            }
            disabled={!formData.placas}
          >
            {editingVehiculo ? 'GUARDAR' : 'REGISTRAR'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
