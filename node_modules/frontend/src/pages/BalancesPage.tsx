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
  Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
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
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((b) => {
              const currentSaldo = Number(b.saldo || 0);
              const maxSaldo = Number(b.max_saldo || 0);
              const minSaldo = b.min_saldo !== null ? Number(b.min_saldo) : null;
              
              const diff = maxSaldo - currentSaldo;
              const recommended = diff > 0 ? diff : 0;
              
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
                      <Chip 
                        label={`+ $${recommended.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} 
                        color="success" 
                        size="small" 
                        sx={{ fontWeight: 800, borderRadius: 1 }} 
                      />
                    ) : (
                      <Typography variant="caption" color="text.disabled">---</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Slot: ${b.slot}`}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        {new Date(b.scraped_at).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Tooltip>
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
    </Box>
  );
};
