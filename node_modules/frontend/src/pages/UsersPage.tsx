import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle, 
  DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, 
  InputLabel, Stack, CircularProgress 
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { api } from '../api/client';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    roles: [] as number[],
    grupos: [] as number[]
  });

  const loadData = async () => {
    try {
      const [uRes, rRes, gRes] = await Promise.all([
        api.get('/api/identity/users'),
        api.get('/api/identity/roles'),
        api.get('/api/identity/groups')
      ]);
      setUsers(uRes.data);
      setRoles(rRes.data);
      setGroups(gRes.data);
    } catch (err) {
      console.error('Error al cargar datos de identidad');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = (user: any = null) => {
    if (user) {
      setEditingUser(user);
      // Extraer IDs de roles y grupos actuales si vienen en el objeto o se pueden mapear
      setFormData({
        nombre: user.nombre,
        email: user.email,
        password: '',
        roles: [], // En una app real, el backend debería devolver los IDs directamente
        grupos: []
      });
    } else {
      setEditingUser(null);
      setFormData({ nombre: '', email: '', password: '', roles: [], grupos: [] });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingUser) {
        await api.put(`/api/identity/users/${editingUser.id}`, formData);
      } else {
        await api.post('/api/identity/users', formData);
      }
      setOpen(false);
      loadData();
    } catch (err) {
      alert('Error al guardar usuario');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('¿Estás seguro de desactivar este usuario?')) {
      try {
        await api.delete(`/api/identity/users/${id}`);
        loadData();
      } catch (err) {
        alert('Error al eliminar');
      }
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-0.02em' }}>
            GESTIÓN DE USUARIOS
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            ADMINISTRACIÓN CENTRALIZADA DE ACCESOS Y PERFILES
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<PersonAddIcon />} 
          onClick={() => handleOpen()}
          sx={{ borderRadius: '12px', px: 3, py: 1.5, fontWeight: 800, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
        >
          NUEVO USUARIO
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>NOMBRE</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>EMAIL</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>ROLES</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>GRUPOS LOGÍSTICOS</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>ESTADO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{u.nombre}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{u.email}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(u.roles?.split(',') || []).map((r: string) => (
                      <Chip key={r} label={r} size="small" sx={{ fontSize: '10px', height: 20, fontWeight: 800, bgcolor: 'rgba(37, 99, 235, 0.08)', color: 'primary.main', mb: 0.5 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    {(u.grupos?.split(',') || []).map((g: string) => (
                      <Chip key={g} label={g} size="small" sx={{ fontSize: '10px', height: 20, fontWeight: 800, bgcolor: 'rgba(16, 185, 129, 0.08)', color: 'success.main', mb: 0.5 }} />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                   <Chip 
                    label={u.activo ? 'ACTIVO' : 'INACTIVO'} 
                    color={u.activo ? 'success' : 'default'}
                    size="small"
                    sx={{ fontWeight: 900, fontSize: '10px' }}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(u)} color="primary" size="small"><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(u.id)} color="error" size="small"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px', p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900, fontSize: '1.5rem' }}>
          {editingUser ? 'EDITAR USUARIO' : 'NUEVO USUARIO'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Nombre Completo"
              fullWidth
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
            <TextField
              label="Email"
              fullWidth
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextField
              label={editingUser ? "Nueva Contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
              fullWidth
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Roles de Sistema</InputLabel>
              <Select
                multiple
                value={formData.roles}
                onChange={(e: any) => setFormData({ ...formData, roles: e.target.value })}
                label="Roles de Sistema"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: number) => (
                      <Chip key={value} label={roles.find(r => r.id === value)?.nombre || value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {roles.map((r) => (
                  <MenuItem key={r.id} value={r.id}>{r.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Grupos Logísticos (Visibilidad)</InputLabel>
              <Select
                multiple
                value={formData.grupos}
                onChange={(e: any) => setFormData({ ...formData, grupos: e.target.value })}
                label="Grupos Logísticos (Visibilidad)"
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value: number) => (
                      <Chip key={value} label={groups.find(g => g.id === value)?.nombre || value} size="small" color="success" variant="outlined" />
                    ))}
                  </Box>
                )}
              >
                {groups.map((g) => (
                  <MenuItem key={g.id} value={g.id}>{g.nombre}</MenuItem>
                ))}
              </Select>
            </FormControl>
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
