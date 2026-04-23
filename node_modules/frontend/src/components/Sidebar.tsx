import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import RuleIcon from '@mui/icons-material/Rule';
import HistoryIcon from '@mui/icons-material/History';
import KeyIcon from '@mui/icons-material/Key';
import PeopleIcon from '@mui/icons-material/People';
import BoltIcon from '@mui/icons-material/Bolt';

const menuItems = [
  { text: 'ACCESOS', icon: <KeyIcon />, path: '/accounts' },
  { text: 'SALDOS', icon: <AccountBalanceWalletIcon />, path: '/balances' },
  { text: 'REGLAS GASOLINA', icon: <RuleIcon />, path: '/admin/reglas' },
  { text: 'CHOFERES', icon: <PeopleIcon />, path: '/admin/choferes' },
  { text: 'VEHÍCULOS', icon: <DirectionsCarIcon />, path: '/admin/vehiculos' },
  { text: 'DISPERSIÓN', icon: <BoltIcon />, path: '/admin/dispersion' },
  { text: 'MOVIMIENTOS', icon: <HistoryIcon />, path: '/movimientos' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Box
      sx={{
        width: 280,
        height: '100vh',
        bgcolor: '#ffffff',
        borderRight: '1px solid rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 1200,
        boxShadow: '4px 0 24px rgba(0,0,0,0.02)'
      }}
    >
      <Box sx={{ p: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box 
          sx={{ 
            width: 40, 
            height: 40, 
            borderRadius: '10px', 
            bgcolor: 'primary.main', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
          }}
        >
          <DirectionsCarIcon sx={{ color: '#fff', fontSize: 24 }} />
        </Box>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 800,
            color: 'text.primary',
            letterSpacing: '0.05rem',
            lineHeight: 1.2,
            fontSize: '1rem'
          }}
        >
          CONTROL<br />VEHICULAR
        </Typography>
      </Box>

      <List sx={{ mt: 2, px: 2 }}>
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  borderRadius: '10px',
                  py: 1.5,
                  backgroundColor: active ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                  color: active ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'rgba(37, 99, 235, 0.04)',
                    color: 'primary.main',
                  },
                  transition: 'all 0.2s ease',
                }}
              >
                <ListItemIcon
                  sx={{
                    color: active ? 'primary.main' : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {React.cloneElement(item.icon as React.ReactElement, { fontSize: 'small' })}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    sx: {
                      fontSize: '0.75rem',
                      fontWeight: active ? 700 : 500,
                      letterSpacing: '0.05rem',
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ mt: 'auto', p: 4, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.1rem' }}>
          APP SISTEMA V3.0<br />MODO CLARO PROFESIONAL
        </Typography>
      </Box>
    </Box>
  );
};
