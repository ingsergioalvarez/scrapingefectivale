import React, { useState } from 'react';
import { 
    Box, 
    Card, 
    CardContent, 
    TextField, 
    Button, 
    Typography, 
    Container, 
    Alert, 
    CircularProgress,
    InputAdornment,
    IconButton
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailIcon from '@mui/icons-material/Email';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await api.post('/api/auth/login', { email, password });
            login(res.data.token, res.data.usuario);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ 
            minHeight: '100vh', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 100%)',
            py: 4
        }}>
            <Container maxWidth="sm">
                <Card sx={{ borderRadius: 4, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                    <Box sx={{ bgcolor: 'white', p: 4, textAlign: 'center', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <Box sx={{ 
                            width: 60, 
                            height: 60, 
                            bgcolor: 'primary.main', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            margin: '0 auto 16px',
                            color: 'white'
                        }}>
                            <LockOutlinedIcon fontSize="large" />
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: -1 }}>
                            CONTROL VEHICULAR
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mt: 0.5 }}>
                            INGRESA TUS CREDENCIALES PARA CONTINUAR
                        </Typography>
                    </Box>

                    <CardContent sx={{ p: 4 }}>
                        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                        <form onSubmit={handleSubmit}>
                            <TextField
                                fullWidth
                                label="CORREO ELECTRÓNICO"
                                variant="outlined"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                sx={{ mb: 3 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon sx={{ color: 'primary.main' }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />

                            <TextField
                                fullWidth
                                label="CONTRASEÑA"
                                type={showPassword ? 'text' : 'password'}
                                variant="outlined"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                sx={{ mb: 4 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockOutlinedIcon sx={{ color: 'primary.main' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={loading}
                                sx={{ 
                                    py: 2, 
                                    fontWeight: 900, 
                                    borderRadius: 2,
                                    boxShadow: '0 8px 16px rgba(13, 71, 161, 0.3)',
                                    '&:hover': {
                                        boxShadow: '0 12px 20px rgba(13, 71, 161, 0.4)',
                                    }
                                }}
                            >
                                {loading ? <CircularProgress size={24} color="inherit" /> : 'INICIAR SESIÓN'}
                            </Button>
                        </form>
                    </CardContent>

                    <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            © 2026 SISTEMA DE CONTROL VEHICULAR | COMUNICALO.MX
                        </Typography>
                    </Box>
                </Card>
            </Container>
        </Box>
    );
};
