import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, 
  DialogContent, DialogActions, TextField, Stack, CircularProgress, 
  Checkbox, FormControlLabel, FormGroup, Grid, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import { api } from '../api/client';

export const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    permisos: [] as number[]
  });

  const loadData = async () => {
    try {
      const [rRes, pRes] = await Promise.all([
        api.get('/api/identity/roles'),
        api.get('/api/identity/permissions')
      ]);
      setRoles(rRes.data);
      setPermissions(pRes.data);
    } catch (err) {
      console.error('Error al cargar roles/permisos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = (role: any = null) => {
    if (role) {
      setEditingRole(role);
      setFormData({
        nombre: role.nombre,
        descripcion: role.descripcion || '',
        permisos: role.permisos || []
      });
    } else {
      setEditingRole(null);
      setFormData({ nombre: '', descripcion: '', permisos: [] });
    }
    setOpen(true);
  };

  const handleTogglePermission = (pId: number) => {
    setFormData(prev => ({
      ...prev,
      permisos: prev.permisos.includes(pId)
        ? prev.permisos.filter(id => id !== pId)
        : [...prev.permisos, pId]
    }));
  };

  const handleSave = async () => {
    try {
      if (editingRole) {
        await api.put(`/api/identity/roles/${editingRole.id}`, formData);
      } else {
        await api.post('/api/identity/roles', formData);
      }
      setOpen(false);
      loadData();
    } catch (err) {
      alert('Error al guardar rol');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-0.02em' }}>
            ROLES Y PERMISOS
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            DEFINICIÓN DE PERFILES DE ACCESO Y SEGURIDAD
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<SecurityIcon />} 
          onClick={() => handleOpen()}
          sx={{ borderRadius: '12px', px: 3, py: 1.5, fontWeight: 800, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
        >
          NUEVO ROL
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>ROL</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>DESCRIPCIÓN</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>PERMISOS</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{r.nombre}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>{r.descripcion}</TableCell>
                <TableCell>
                  <Chip 
                    label={`${r.permisos?.length || 0} PERMISOS`} 
                    size="small" 
                    variant="outlined"
                    sx={{ fontWeight: 800, fontSize: '10px' }} 
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(r)} color="primary" size="small"><EditIcon /></IconButton>
                  <IconButton disabled={r.nombre === 'ADMIN'} color="error" size="small"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem' }}>
          {editingRole ? 'EDITAR ROL' : 'NUEVO ROL'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Nombre del Rol"
              fullWidth
              disabled={editingRole?.nombre === 'ADMIN'}
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
            <TextField
              label="Descripción"
              fullWidth
              multiline
              rows={2}
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
            
            <Box>
              <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main' }}>
                SELECCIONAR PERMISOS
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={1}>
                {permissions.map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.id}>
                    <FormControlLabel
                      control={
                        <Checkbox 
                          size="small"
                          checked={formData.permisos.includes(p.id)}
                          onChange={() => handleTogglePermission(p.id)}
                        />
                      }
                      label={
                        <Box>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800 }}>{p.codigo}</Typography>
                          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{p.descripcion}</Typography>
                        </Box>
                      }
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} sx={{ fontWeight: 800, color: 'text.secondary' }}>CANCELAR</Button>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: '10px', px: 4, fontWeight: 800 }}>GUARDAR</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
