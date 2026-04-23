import React, { useEffect, useState } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, IconButton, Tooltip, TextField, InputAdornment, Stack, Button } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PendingIcon from '@mui/icons-material/Pending';
import SearchIcon from '@mui/icons-material/Search';
import { api } from '../api/client';

interface Movimiento {
  id: string;
  solicitante_name: string | null;
  cuenta: string | null;
  tarjeta_ultimos7: string | null;
  monto: number;
  status: 'pending' | 'dispersed' | 'rejected' | 'error';
  admin_note: string | null;
  admin_approver_name: string | null;
  error_message: string | null;
  created_at: string;
}

export const MovimientosPage: React.FC = () => {
  const [data, setData] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMovimientos = async () => {
    try {
      const res = await api.get('/api/admin/gasolina');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching movimientos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await api.post(`/api/admin/gasolina/${id}/${action}`, {});
      fetchMovimientos();
    } catch (err: any) {
      alert('ERROR: ' + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => {
    fetchMovimientos();
    const interval = setInterval(fetchMovimientos, 20000); // 20s refresh
    return () => clearInterval(interval);
  }, []);

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'dispersed':
        return <Chip label="DISPERSADO" color="success" size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: '10px' }} />;
      case 'rejected':
        return <Chip label="RECHAZADO" color="error" size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: '10px' }} />;
      case 'error':
        return <Chip icon={<ErrorIcon />} label="ERROR" color="warning" size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: '10px' }} />;
      default:
        return <Chip icon={<PendingIcon />} label="PENDIENTE" color="info" size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: '10px' }} />;
    }
  };

  const filtered = data.filter(m => 
    (m.solicitante_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.cuenta || '').includes(search)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 6 }}>
        <Box>
          <Typography variant="h4">HISTORIAL DE MOVIMIENTOS</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05rem', mt: 0.5 }}>
            REGISTRO DE SOLICITUDES Y CARGAS DE COMBUSTIBLE
          </Typography>
        </Box>

        <TextField
          placeholder="BUSCAR EMPLEADO O ID..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 350 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>FECHA</TableCell>
              <TableCell>SOLICITANTE</TableCell>
              <TableCell>CUENTA/TARJETA</TableCell>
              <TableCell>MONTO</TableCell>
              <TableCell>ESTADO</TableCell>
              <TableCell>APROBADOR</TableCell>
              <TableCell align="right">INFO</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 500 }}>
                  {new Date(m.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }).toUpperCase()}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  {m.solicitante_name || 'SISTEMA'}
                </TableCell>
                <TableCell sx={{ color: 'primary.main', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {m.cuenta || m.tarjeta_ultimos7 || '---'}
                </TableCell>
                <TableCell sx={{ fontWeight: 800 }}>
                  ${(m.monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {getStatusChip(m.status)}
                    {m.status === 'pending' && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          sx={{ fontSize: '9px', height: 24, px: 1, fontWeight: 900 }}
                          onClick={() => handleAction(m.id, 'approve')}
                        >
                          AUTORIZAR
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="error"
                          sx={{ fontSize: '9px', height: 24, px: 1, fontWeight: 900 }}
                          onClick={() => handleAction(m.id, 'reject')}
                        >
                          RECHAZAR
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                  {m.admin_approver_name || '---'}
                </TableCell>
                <TableCell align="right">
                  {(m.admin_note || m.error_message) && (
                    <Tooltip title={m.admin_note || m.error_message || ''} arrow placement="left">
                      <IconButton size="small" sx={{ color: m.status === 'error' ? 'error.main' : 'primary.main' }}>
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'text.disabled', fontStyle: 'italic', textTransform: 'uppercase' }}>
                  NO SE ENCONTRARON MOVIMIENTOS
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
