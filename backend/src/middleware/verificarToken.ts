import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'gasolina_secret_key_12345';

export interface AuthRequest extends Request {
    usuario?: {
        id: number;
        empresa_id: number;
        roles: string[];
        permisos: string[];
    };
}

/**
 * Middleware para verificar la validez del token JWT
 * OBLIGATORIO según Regla 3 de la Arquitectura Oficial
 */
export const verificarToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
};
