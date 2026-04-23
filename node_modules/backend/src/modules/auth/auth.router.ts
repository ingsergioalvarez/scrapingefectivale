import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../../store/mysql-store';

const authRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gasolina_secret_key_12345';

/**
 * Endpoint de Login - ARQUITECTURA OFICIAL (Simulador OAuth2)
 */
authRouter.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    try {
        const user = await getUserByEmail(email);

        if (!user) {
            console.log(`[auth] Usuario no encontrado: ${email}`);
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            console.log(`[auth] Contraseña incorrecta para: ${email}`);
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // Generar JWT con claims requeridos (Regla 3)
        const token = jwt.sign(
            {
                sub: user.id,
                nombre: user.nombre,
                email: user.email,
                empresa_id: user.empresa_id,
                permisos: user.permisos
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            usuario: {
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                permisos: user.permisos
            }
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default authRouter;
