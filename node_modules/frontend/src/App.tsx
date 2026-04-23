import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { Layout } from './components/Layout';
import { AccountsPage } from './pages/AccountsPage';
import { AdminRulesPage } from './pages/AdminRulesPage';
import { BalancesPage } from './pages/BalancesPage';
import { MovimientosPage } from './pages/MovimientosPage';
import { ChoferesPage } from './pages/ChoferesPage';
import { VehiculosPage } from './pages/VehiculosPage';

const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // Professional blue
      light: '#60a5fa',
      dark: '#1d4ed8',
    },
    secondary: {
      main: '#64748b', // Slate grey
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
      textTransform: 'uppercase',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'uppercase',
          fontWeight: 700,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.05)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: '0.75rem',
          color: '#64748b',
          backgroundColor: '#f1f5f9',
        },
        root: {
          padding: '16px',
        }
      }
    }
  },
});

export default function App() {
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/balances" replace />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/balances" element={<BalancesPage />} />
          <Route path="/admin/reglas" element={<AdminRulesPage />} />
          <Route path="/admin/choferes" element={<ChoferesPage />} />
          <Route path="/admin/vehiculos" element={<VehiculosPage />} />
          <Route path="/movimientos" element={<MovimientosPage />} />
          <Route path="/admin/gasolina" element={<Navigate to="/movimientos" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  );
}
