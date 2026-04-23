import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box, CircularProgress } from '@mui/material';
import { Layout } from './components/Layout';
import { AccountsPage } from './pages/AccountsPage';
import { AdminRulesPage } from './pages/AdminRulesPage';
import { BalancesPage } from './pages/BalancesPage';
import { MovimientosPage } from './pages/MovimientosPage';
import { ChoferesPage } from './pages/ChoferesPage';
import { VehiculosPage } from './pages/VehiculosPage';
import { DispersePage } from './pages/DispersePage';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { GroupsPage } from './pages/GroupsPage';
import { AuthProvider, useAuth } from './auth/AuthContext';

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

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <Navigate to="/balances" replace />
              </Layout>
            </ProtectedRoute>
          } />

          <Route path="/accounts" element={<ProtectedRoute><Layout><AccountsPage /></Layout></ProtectedRoute>} />
          <Route path="/balances" element={<ProtectedRoute><Layout><BalancesPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/reglas" element={<ProtectedRoute><Layout><AdminRulesPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/choferes" element={<ProtectedRoute><Layout><ChoferesPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/vehiculos" element={<ProtectedRoute><Layout><VehiculosPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/dispersion" element={<ProtectedRoute><Layout><DispersePage /></Layout></ProtectedRoute>} />
          <Route path="/movimientos" element={<ProtectedRoute><Layout><MovimientosPage /></Layout></ProtectedRoute>} />
          <Route path="/identity/users" element={<ProtectedRoute requiredPermission="IDENTITY_GESTION"><Layout><UsersPage /></Layout></ProtectedRoute>} />
          <Route path="/identity/roles" element={<ProtectedRoute requiredPermission="IDENTITY_GESTION"><Layout><RolesPage /></Layout></ProtectedRoute>} />
          <Route path="/identity/groups" element={<ProtectedRoute requiredPermission="IDENTITY_GESTION"><Layout><GroupsPage /></Layout></ProtectedRoute>} />
          <Route path="/admin/gasolina" element={<Navigate to="/movimientos" replace />} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/balances" replace />} />
        </Routes>
      </ThemeProvider>
    </AuthProvider>
  );
}
