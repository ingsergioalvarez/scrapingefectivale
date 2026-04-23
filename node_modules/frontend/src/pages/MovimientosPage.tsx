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
  tarjeta: string | null;
  codigo_card: string | null;
  chofer_nombre: string | null;
  vehiculo_placas: string | null;
  vehiculo_modelo: string | null;
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
    const interval = setInterval(fetchMovimientos, 20000); 
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
    (m.chofer_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.vehiculo_placas || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.cuenta || '').includes(search) ||
    (m.tarjeta || '').includes(search)
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main' }}>HISTORIAL DE MOVIMIENTOS</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05rem', mt: 0.5, fontWeight: 700 }}>
            TRAZABILIDAD TOTAL DE DISPERSIONES Y SOLICITUDES
          </Typography>
        </Box>

        <TextField
          placeholder="BUSCAR CHOFER, PLACAS O CUENTA..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 400 }}
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
        <Table size="small">
          <TableHead sx={{ bgcolor: 'grey.50' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>FECHA / HORA</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CHOFER</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>VEHÍCULO</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>TARJETA / CÓDIGO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>MONTO</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ESTADO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>INFO</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', fontWeight: 600 }}>
                  {new Date(m.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }).toUpperCase()}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>
                    {m.chofer_nombre || (m.solicitante_name === 'SISTEMA' ? 'OPERACIÓN AUTOMÁTICA' : m.solicitante_name || '---')}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                    {m.vehiculo_placas || '---'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '10px' }}>
                    {m.vehiculo_modelo || ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                    {m.tarjeta || m.cuenta || '---'}
                  </Typography>
                  {m.codigo_card && (
                    <Chip label={`CÓD: ${m.codigo_card}`} size="small" sx={{ height: 16, fontSize: '9px', mt: 0.5, fontWeight: 900 }} />
                  )}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, color: 'success.main', fontSize: '1rem' }}>
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
