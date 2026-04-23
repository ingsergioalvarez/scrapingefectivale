import { Response, NextFunction } from 'express';
import { AuthRequest } from './verificarToken';

/**
 * Middleware para autorizar por permisos específicos
 * OBLIGATORIO según Regla 3 y 8 de la Arquitectura Oficial
 * 
 * Uso: router.get('/ruta', verificarToken, verificarPermiso('MODULO_ACCION'), (req, res) => { ... })
 */
export const verificarPermiso = (permisoRequerido: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        const { permisos } = req.usuario || {};

        if (!permisos || !Array.isArray(permisos)) {
            return res.status(403).json({ error: 'No tienes los permisos necesarios para esta acción.' });
        }

        // Regla 8: Autorizar por permisos, no por roles
        const tienePermiso = permisos.includes(permisoRequerido) || permisos.includes('ADMIN_FULL_ACCESS');

        if (!tienePermiso) {
            return res.status(403).json({ error: `Falta permiso requerido: ${permisoRequerido}` });
        }

        next();
    };
};
