import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

interface Usuario {
    id: number;
    nombre: string;
    email: string;
    permisos: string[];
}

interface AuthContextType {
    usuario: Usuario | null;
    token: string | null;
    login: (token: string, usuario: Usuario) => void;
    logout: () => void;
    isLoading: boolean;
    hasPermission: (permiso: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUsuario(JSON.parse(storedUser));
            // Configurar token en axios para futuras peticiones
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setIsLoading(false);
    }, []);

    const login = (newToken: string, newUsuario: Usuario) => {
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUsuario));
        setToken(newToken);
        setUsuario(newUsuario);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUsuario(null);
        delete api.defaults.headers.common['Authorization'];
        window.location.href = '/login';
    };

    const hasPermission = (permiso: string) => {
        return usuario?.permisos.includes(permiso) || usuario?.permisos.includes('ADMIN_FULL_ACCESS') || false;
    };

    return (
        <AuthContext.Provider value={{ usuario, token, login, logout, isLoading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
};
