import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  TextField, 
  InputAdornment, 
  Stack, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import KeyIcon from '@mui/icons-material/Key';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { api } from '../api/client';

interface Balance {
  cuenta: string;
  tarjeta: string;
  display_name: string;
  short_code: number | null;
  min_saldo: number | null;
  max_saldo: number | null;
  chofer_nombre: string | null;
  saldo: number;
  scraped_at: string;
  slot: string;
  account_alias: string | null;
}

export const BalancesPage: React.FC = () => {
  const [data, setData] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nipDialogOpen, setNipDialogOpen] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState<string | null>(null);
  const [viewedNip, setViewedNip] = useState<string | null>(null);
  const [nipLoading, setNipLoading] = useState(false);

  const fetchBalances = async () => {
    try {
      const res = await api.get('/api/admin/balances');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNipDialog = (cuenta: string) => {
    setSelectedCuenta(cuenta);
    setViewedNip(null);
    setNipDialogOpen(true);
  };

  const handleConsultNip = async () => {
    if (!selectedCuenta) return;
    setNipLoading(true);
    try {
      const res = await api.get(`/api/admin/rules/nip/${selectedCuenta}`);
      setViewedNip(res.data.nip);
    } catch (err: any) {
      alert('Error al consultar NIP: ' + (err.response?.data?.error || err.message));
    } finally {
      setNipLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = data.filter(b => 
    (b.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.chofer_nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.cuenta || '').includes(search)
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 6, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Box>
          <Typography variant="h4">MONITOREO DE SALDOS</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05rem', mt: 0.5 }}>
            ESTADO ACTUAL Y RECOMENDACIÓN DE CARGA PARA LA FLOTA
          </Typography>
        </Box>

        <TextField
          placeholder="BUSCAR ALIAS, CHOFER O CUENTA..."
          variant="outlined"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 350 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(0,0,0,0.05)', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>CÓDIGO</TableCell>
              <TableCell>ALIAS / IDENTIFICACIÓN</TableCell>
              <TableCell>CHOFER ASIGNADO</TableCell>
              <TableCell>FRECUENCIA</TableCell>
              <TableCell>CUENTA ORIGEN</TableCell>
              <TableCell align="right">SALDO ACTUAL</TableCell>
              <TableCell align="right">CARGA RECOMENDADA</TableCell>
              <TableCell align="right">ÚLTIMA SYNC</TableCell>
              <TableCell align="right">SEGURIDAD</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((b) => {
              const currentSaldo = Number(b.saldo || 0);
              const maxSaldo = Number(b.max_saldo || 0);
              const minSaldo = b.min_saldo !== null ? Number(b.min_saldo) : null;
              const isAcumular = b.modo_carga === 'ACUMULAR';
              
              const recommended = isAcumular ? maxSaldo : (maxSaldo - currentSaldo > 0 ? maxSaldo - currentSaldo : 0);
              
              return (
                <TableRow key={b.cuenta} hover>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>
                    {b.short_code ?? '---'}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' }}>
                      {b.display_name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {b.cuenta}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.8rem' }}>
                    {b.chofer_nombre || (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                        SIN ASIGNAR
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ textTransform: 'uppercase', fontWeight: 700, color: 'info.main', fontSize: '0.75rem' }}>
                    {b.frecuencia || '---'}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={b.account_alias?.toUpperCase() || 'GENERAL'} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontWeight: 800, fontSize: '10px' }} 
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    fontWeight: 900, 
                    color: (minSaldo !== null && currentSaldo < minSaldo) ? 'error.main' : 'inherit', 
                    fontSize: '1rem' 
                  }}>
                    ${currentSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell align="right">
                    {recommended > 0 ? (
                      <Stack direction="column" alignItems="flex-end" spacing={0.5}>
                        <Chip 
                          label={`+ $${recommended.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} 
                          color={isAcumular ? "secondary" : "success"} 
                          size="small" 
                          sx={{ fontWeight: 800, borderRadius: 1 }} 
                        />
                        <Typography variant="caption" sx={{ fontSize: '8px', fontWeight: 900, color: 'text.disabled', textTransform: 'uppercase' }}>
                          {isAcumular ? 'MODO ACUMULAR' : 'MODO COMPLETAR'}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="caption" color="text.disabled">---</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Slot: ${b.slot}`}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {new Date(b.scraped_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' })}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="primary"
                      startIcon={<LockOpenIcon />}
                      onClick={() => handleOpenNipDialog(b.cuenta)}
                      sx={{ fontSize: '10px', fontWeight: 800, borderRadius: 2 }}
                    >
                      VER NIP
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 8, color: 'text.disabled', fontStyle: 'italic' }}>
                  NO SE ENCONTRARON REGISTROS CON EL FILTRO ACTUAL
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* DIÁLOGO DE SEGURIDAD NIP */}
      <Dialog open={nipDialogOpen} onClose={() => setNipDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, color: 'primary.main' }}>
          CONSULTA DE SEGURIDAD (NIP)
        </DialogTitle>
        <DialogContent dividers>
          {!viewedNip ? (
            <>
              <Alert severity="warning" sx={{ mb: 2, fontWeight: 700 }}>
                ATENCIÓN: EL ACCESO A ESTA INFORMACIÓN ES BAJO SU ESTRICTA RESPONSABILIDAD.
              </Alert>
              <Typography variant="body2" sx={{ textAlign: 'center', mb: 2, fontWeight: 600 }}>
                Esta consulta será registrada en su historial de usuario para auditoría interna.<br/><br/>
                ¿Desea continuar?
              </Typography>
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom sx={{ fontWeight: 700 }}>
                NIP ASIGNADO A LA TARJETA:
              </Typography>
              <Typography variant="h2" color="primary" sx={{ fontWeight: 900, letterSpacing: '0.5rem' }}>
                {viewedNip}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNipDialogOpen(false)} color="inherit" sx={{ fontWeight: 800 }}>
            {viewedNip ? 'CERRAR' : 'CANCELAR'}
          </Button>
          {!viewedNip && (
            <Button 
              onClick={handleConsultNip} 
              variant="contained" 
              color="primary" 
              disabled={nipLoading}
              sx={{ fontWeight: 800 }}
            >
              {nipLoading ? 'CONSULTANDO...' : 'SÍ, CONSULTAR NIP'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
