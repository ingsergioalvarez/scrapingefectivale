import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle, 
  DialogContent, DialogActions, TextField, Stack, CircularProgress 
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { api } from '../api/client';

export const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });

  const loadData = async () => {
    try {
      const res = await api.get('/api/identity/groups');
      setGroups(res.data);
    } catch (err) {
      console.error('Error al cargar grupos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpen = (group: any = null) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        nombre: group.nombre,
        descripcion: group.descripcion || ''
      });
    } else {
      setEditingGroup(null);
      setFormData({ nombre: '', descripcion: '' });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingGroup) {
        await api.put(`/api/identity/groups/${editingGroup.id}`, formData);
      } else {
        await api.post('/api/identity/groups', formData);
      }
      setOpen(false);
      loadData();
    } catch (err) {
      alert('Error al guardar grupo');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-0.02em' }}>
            GRUPOS LOGÍSTICOS
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            SEGMENTACIÓN DE FLOTAS Y VISIBILIDAD DE TARJETAS
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpen()}
          sx={{ borderRadius: '12px', px: 3, py: 1.5, fontWeight: 800 }}
        >
          NUEVO GRUPO
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.04)' }}>
        <Table>
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 800 }}>NOMBRE</TableCell>
              <TableCell sx={{ fontWeight: 800 }}>DESCRIPCIÓN</TableCell>
              <TableCell align="right" sx={{ fontWeight: 800 }}>ACCIONES</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id} hover>
                <TableCell sx={{ fontWeight: 700 }}>{g.nombre}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{g.descripcion}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleOpen(g)} color="primary" size="small"><EditIcon /></IconButton>
                  <IconButton color="error" size="small"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingGroup ? 'EDITAR GRUPO' : 'NUEVO GRUPO'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              label="Nombre del Grupo"
              fullWidth
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
            />
            <TextField
              label="Descripción"
              fullWidth
              multiline
              rows={3}
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} sx={{ fontWeight: 800 }}>CANCELAR</Button>
          <Button onClick={handleSave} variant="contained" sx={{ borderRadius: '10px', fontWeight: 800 }}>GUARDAR</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
