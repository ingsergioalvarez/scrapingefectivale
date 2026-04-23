import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Checkbox, 
  Button, 
  TextField, 
  Stack, 
  Chip, 
  CircularProgress, 
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  IconButton,
  Tooltip,
  InputAdornment,
  LinearProgress
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SearchIcon from '@mui/icons-material/Search';
import BoltIcon from '@mui/icons-material/Bolt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

type BalanceRow = {
  cuenta: string;
  tarjeta: string;
  display_name: string;
  short_code: number | null;
  min_saldo: number | null;
  max_saldo: number | null;
  modo_carga: 'COMPLETAR' | 'ACUMULAR' | null;
  frecuencia: string | null;
  chofer_nombre: string | null;
  saldo: number;
  scraped_at: string;
  slot: string;
  account_alias?: string;
  efectivale_account_id?: number;
};

type LogEntry = {
  cuenta: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
};

export function DispersePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isRefreshingWallet, setIsRefreshingWallet] = useState(false);

  const { data: balances = [], isLoading, error: balancesError } = useQuery({
    queryKey: ['admin-balances'],
    queryFn: async () => {
      const { data } = await api.get<BalanceRow[]>('/api/admin/balances');
      return data || [];
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ['admin_accounts'],
    queryFn: () => api.get('/api/admin/accounts').then(r => r.data)
  });

  const refreshWallet = async () => {
    const accId = accounts?.[0]?.id;
    if (!accId) return;
    setIsRefreshingWallet(true);
    try {
      const res = await api.get(`/api/admin/wallet-balance/${accId}`);
      if (res.data && res.data.ok) setWalletBalance(res.data.balance);
    } catch (e) {
      console.error("Error fetching wallet balance", e);
    } finally {
      setIsRefreshingWallet(false);
    }
  };

  useEffect(() => {
    if (accounts?.[0]) {
      setWalletBalance(Number(accounts[0].wallet_balance || 0));
    }
  }, [accounts]);

  const calculateRecommended = (b: BalanceRow) => {
    const currentSaldo = Number(b.saldo || 0);
    const maxSaldo = Number(b.max_saldo || 0);
    const isAcumular = b.modo_carga === 'ACUMULAR';
    const rec = isAcumular ? maxSaldo : (maxSaldo - currentSaldo > 0 ? maxSaldo - currentSaldo : 0);
    return Math.round(rec * 100) / 100;
  };

  const filtered = balances.filter(b => 
    b.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    b.cuenta.includes(search) ||
    b.tarjeta.includes(search) ||
    b.short_code?.toString().includes(search)
  );

  const toggleSelect = (cuenta: string) => {
    const isNowSelected = !selected[cuenta];
    setSelected(prev => ({ ...prev, [cuenta]: isNowSelected }));
    if (isNowSelected && customAmounts[cuenta] === undefined) {
      const b = balances.find(x => x.cuenta === cuenta);
      if (b) setCustomAmounts(prev => ({ ...prev, [cuenta]: calculateRecommended(b) }));
    }
  };

  const selectAll = () => {
    const newSelected: Record<string, boolean> = {};
    const newAmounts: Record<string, number> = { ...customAmounts };
    filtered.forEach(b => {
      newSelected[b.cuenta] = true;
      if (newAmounts[b.cuenta] === undefined) newAmounts[b.cuenta] = calculateRecommended(b);
    });
    setSelected(newSelected);
    setCustomAmounts(newAmounts);
  };

  const deselectAll = () => setSelected({});

  const selectCritical = () => {
    const newSelected: Record<string, boolean> = {};
    const newAmounts: Record<string, number> = { ...customAmounts };
    filtered.forEach(b => {
      if (b.min_saldo !== null && Number(b.saldo) < Number(b.min_saldo)) {
        newSelected[b.cuenta] = true;
        if (newAmounts[b.cuenta] === undefined) newAmounts[b.cuenta] = calculateRecommended(b);
      }
    });
    setSelected(newSelected);
    setCustomAmounts(newAmounts);
  };

  const handleAmountChange = (cuenta: string, val: string) => {
    setCustomAmounts(prev => ({ ...prev, [cuenta]: Number(val) }));
  };

  const toDisperse = filtered.filter(b => selected[b.cuenta]);
  const totalAmount = toDisperse.reduce((acc, b) => acc + (customAmounts[b.cuenta] ?? calculateRecommended(b)), 0);
  const finalBalanceEstimate = (walletBalance || 0) - totalAmount;
  const isInsufficient = finalBalanceEstimate < 0;
  const selectedCount = toDisperse.length;

  const handleStartDispersion = async () => {
    if (toDisperse.length === 0) return;
    
    // Validar límites antes de procesar
    const oversized = toDisperse.filter(b => {
        if (b.modo_carga === 'ACUMULAR') return false;
        const monto = customAmounts[b.cuenta] ?? calculateRecommended(b);
        return (Number(b.saldo) + monto) > (b.max_saldo || 0);
    });
    if (oversized.length > 0) {
        if (!window.confirm(`Atención: ${oversized.length} tarjetas en modo COMPLETAR superarán su límite máximo. ¿Deseas continuar?`)) return;
    }

    if (!window.confirm(`¿Estás seguro de procesar ${toDisperse.length} recargas por un total de $${totalAmount.toLocaleString()}?`)) return;

    setIsProcessing(true);
    setLogs(toDisperse.map(b => ({ cuenta: b.cuenta, status: 'pending' })));

    for (let i = 0; i < toDisperse.length; i++) {
        const b = toDisperse[i];
        setLogs(prev => prev.map(l => l.cuenta === b.cuenta ? { ...l, status: 'loading' } : l));
        try {
            const monto = customAmounts[b.cuenta] ?? calculateRecommended(b);
            const { data } = await api.post('/api/admin/disperse-bulk', { 
                requests: [{ cuenta: b.cuenta, monto, accountId: b.efectivale_account_id }] 
            });
            const result = data.results[0];
            setLogs(prev => prev.map(l => l.cuenta === b.cuenta ? { ...l, status: result.success ? 'success' : 'error', message: result.success ? result.message : result.error } : l));
        } catch (e: any) {
            setLogs(prev => prev.map(l => l.cuenta === b.cuenta ? { ...l, status: 'error', message: e.message } : l));
        }
    }
    setIsProcessing(false);
    qc.invalidateQueries({ queryKey: ['admin-balances'] });
    refreshWallet();
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>;
  if (balancesError) return <Container sx={{ py: 4 }}><Alert severity="error">Error al cargar saldos: {(balancesError as any).message}</Alert></Container>;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
            DISPERSIÓN MASIVA
        </Typography>
        <Typography variant="body2" color="text.secondary">
            Gestión sincronizada de fondos para flota de vehículos
        </Typography>
      </Box>

      {/* DASHBOARD DE SALDOS */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={7}>
            <Card sx={{ height: '100%', borderLeft: 6, borderColor: 'primary.main' }}>
                <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Saldo Monedero Efectivale
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                <WalletIcon color="primary" />
                                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                                    ${(walletBalance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                                </Typography>
                                <Tooltip title="Actualizar saldo real">
                                    <IconButton onClick={refreshWallet} disabled={isRefreshingWallet} size="small">
                                        {isRefreshingWallet ? <CircularProgress size={20} /> : <SyncIcon />}
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                                Total Seleccionado
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                ${totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            </Typography>
                        </Box>
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Saldo Post-Dispersión:
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 900, color: isInsufficient ? 'error.main' : 'success.main' }}>
                            ${finalBalanceEstimate.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                            {isInsufficient && " (FONDOS INSUFICIENTES)"}
                        </Typography>
                    </Stack>
                </CardContent>
            </Card>
        </Grid>

        <Grid item xs={12} md={5}>
            <Card sx={{ height: '100%', bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Control de Cargas
                        </Typography>
                        <Tooltip title="Prioritarios: Tarjetas con saldo actual menor al saldo mínimo configurado en sus reglas.">
                            <IconButton size="small" sx={{ color: 'white' }}>
                                <InfoIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                    <Stack spacing={2}>
                        <Stack direction="row" spacing={1}>
                            <Button 
                                fullWidth 
                                variant="contained" 
                                color="inherit" 
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} 
                                onClick={selectCritical}
                            >
                                Seleccionar Críticos
                            </Button>
                            <Button 
                                fullWidth 
                                variant="contained" 
                                color="inherit" 
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 700 }} 
                                onClick={selectAll}
                            >
                                Marcar Todos
                            </Button>
                        </Stack>
                        <Button 
                            fullWidth 
                            size="large" 
                            variant="contained" 
                            color="secondary" 
                            disabled={toDisperse.length === 0 || isProcessing || isInsufficient}
                            startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <BoltIcon />}
                            onClick={handleStartDispersion}
                            sx={{ fontWeight: 900, py: 1.5 }}
                        >
                            {isProcessing ? 'PROCESANDO...' : `DISPERSAR $${totalAmount.toLocaleString()}`}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Grid>
      </Grid>

      {/* BARRA DE BÚSQUEDA Y ACCIONES */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center">
          <TextField
            placeholder="BUSCAR POR ALIAS, CÓDIGO O TARJETA..."
            variant="outlined"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            }}
          />
          <Button variant="outlined" color="inherit" onClick={deselectAll}>Limpiar</Button>
      </Stack>

      {/* LOG EN TIEMPO REAL */}
      {(isProcessing || logs.length > 0) && (
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
               <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>PROGRESO DE OPERACIÓN</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 900 }}>
                    {logs.filter(l => l.status === 'success' || l.status === 'error').length} / {logs.length}
                  </Typography>
               </Stack>
               <LinearProgress 
                variant="determinate" 
                value={(logs.filter(l => l.status === 'success' || l.status === 'error').length / logs.length) * 100} 
                sx={{ height: 10, borderRadius: 5, mb: 2 }} 
               />
               <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
                    {logs.map((log, i) => (
                        <Stack key={i} direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                            {log.status === 'loading' && <CircularProgress size={10} />}
                            {log.status === 'success' && <CheckCircleIcon color="success" sx={{ fontSize: 14 }} />}
                            {log.status === 'error' && <ErrorIcon color="error" sx={{ fontSize: 14 }} />}
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                [{log.cuenta}] {log.status.toUpperCase()}: {log.message || 'Esperando...'}
                            </Typography>
                        </Stack>
                    ))}
               </Box>
          </Paper>
      )}

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
        <Table size="small">
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell padding="checkbox">
                  <Checkbox 
                    indeterminate={selectedCount > 0 && selectedCount < filtered.length}
                    checked={filtered.length > 0 && selectedCount === filtered.length}
                    onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                  />
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CÓDIGO</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>ALIAS / TARJETA</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>CHOFER</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>SALDO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>MÁXIMO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>SUGERIDO</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, width: 140 }}>A CARGAR ($)</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>POLÍTICA</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((b) => {
              const currentSaldo = Number(b.saldo || 0);
              const minSaldo = b.min_saldo !== null ? Number(b.min_saldo) : null;
              const recommended = calculateRecommended(b);
              const isSelected = !!selected[b.cuenta];
              const amount = customAmounts[b.cuenta] ?? recommended;
              const isLow = minSaldo !== null && currentSaldo < minSaldo;
              
              return (
                <TableRow 
                    key={b.cuenta} 
                    hover 
                    selected={isSelected} 
                    sx={{ 
                        bgcolor: isLow ? 'rgba(211, 47, 47, 0.05)' : 'inherit',
                        borderLeft: isLow ? '4px solid #d32f2f' : 'none'
                    }}
                >
                  <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} onChange={() => toggleSelect(b.cuenta)} />
                  </TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 800 }}>
                    {b.short_code ?? '---'}
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>{b.display_name}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{b.cuenta}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography sx={{ textTransform: 'uppercase', fontSize: '0.85rem', fontWeight: 900, color: 'text.primary' }}>
                      {b.chofer_nombre || '---'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900, color: isLow ? 'error.main' : 'inherit' }}>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                        {isLow && <Tooltip title="SALDO POR DEBAJO DEL MÍNIMO"><ErrorIcon color="error" sx={{ fontSize: 16 }} /></Tooltip>}
                        <Typography sx={{ fontWeight: 900 }}>
                            ${currentSaldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                    ${(b.max_saldo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                        ${recommended.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TextField 
                        size="small"
                        type="number"
                        variant="outlined"
                        value={amount}
                        onChange={(e) => handleAmountChange(b.cuenta, e.target.value)}
                        disabled={!isSelected}
                        InputProps={{
                            sx: { 
                                height: 32, 
                                fontSize: '0.85rem', 
                                fontWeight: 900,
                                bgcolor: isSelected ? '#fff' : '#f8fafc'
                            }
                        }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                        label={b.modo_carga || 'COMPLETAR'} 
                        size="small" 
                        color={b.modo_carga === 'ACUMULAR' ? 'secondary' : 'default'}
                        variant={b.modo_carga === 'ACUMULAR' ? 'filled' : 'outlined'}
                        sx={{ fontWeight: 900, fontSize: '9px', height: 18 }} 
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}
