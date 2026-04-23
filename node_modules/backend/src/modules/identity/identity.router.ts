import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../../db';

const router = Router();

// --- USUARIOS ---

// Listar usuarios (Solo activos por defecto)
router.get('/users', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.id, u.nombre, u.email, u.activo, u.fecha_creacion,
                   GROUP_CONCAT(DISTINCT r.nombre) as roles,
                   GROUP_CONCAT(DISTINCT g.nombre) as grupos
            FROM sys_usuarios u
            LEFT JOIN sys_usuario_roles ur ON u.id = ur.usuario_id
            LEFT JOIN sys_roles r ON ur.rol_id = r.id
            LEFT JOIN cv_usuario_grupos ug ON u.id = ug.usuario_id
            LEFT JOIN cv_grupos g ON ug.grupo_id = g.id
            WHERE u.activo = 1
            GROUP BY u.id
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar usuarios' });
    }
});

// ... (Crear/Editar usuarios - ya manejan roles, añadiré grupos) ...
// (Omitido por brevedad en este chunk, lo haré en el siguiente)

// --- GRUPOS LOGÍSTICOS ---

router.get('/groups', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cv_grupos WHERE activo = 1');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar grupos' });
    }
});

router.post('/groups', async (req, res) => {
    const { nombre, descripcion } = req.body;
    try {
        const [result]: any = await pool.execute('INSERT INTO cv_grupos (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion]);
        res.json({ id: result.insertId, message: 'Grupo creado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear grupo' });
    }
});

// Crear usuario
router.post('/users', async (req, res) => {
    const { nombre, email, password, roles, grupos } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        const [result]: any = await pool.execute(
            'INSERT INTO sys_usuarios (nombre, email, password_hash) VALUES (?, ?, ?)',
            [nombre, email, hash]
        );
        const userId = result.insertId;

        if (roles && Array.isArray(roles)) {
            for (const roleId of roles) {
                await pool.execute('INSERT INTO sys_usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [userId, roleId]);
            }
        }
        if (grupos && Array.isArray(grupos)) {
            for (const grpId of grupos) {
                await pool.execute('INSERT INTO cv_usuario_grupos (usuario_id, grupo_id) VALUES (?, ?)', [userId, grpId]);
            }
        }
        res.json({ id: userId, message: 'Usuario creado con éxito' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear usuario' });
    }
});

// Actualizar usuario
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, email, password, roles, grupos, activo } = req.body;
    try {
        if (password) {
            const hash = await bcrypt.hash(password, 10);
            await pool.execute('UPDATE sys_usuarios SET nombre=?, email=?, password_hash=?, activo=? WHERE id=?', [nombre, email, hash, activo === false ? 0 : 1, id]);
        } else {
            await pool.execute('UPDATE sys_usuarios SET nombre=?, email=?, activo=? WHERE id=?', [nombre, email, activo === false ? 0 : 1, id]);
        }

        if (roles && Array.isArray(roles)) {
            await pool.execute('DELETE FROM sys_usuario_roles WHERE usuario_id = ?', [id]);
            for (const roleId of roles) {
                await pool.execute('INSERT INTO sys_usuario_roles (usuario_id, rol_id) VALUES (?, ?)', [id, roleId]);
            }
        }
        if (grupos && Array.isArray(grupos)) {
            await pool.execute('DELETE FROM cv_usuario_grupos WHERE usuario_id = ?', [id]);
            for (const grpId of grupos) {
                await pool.execute('INSERT INTO cv_usuario_grupos (usuario_id, grupo_id) VALUES (?, ?)', [id, grpId]);
            }
        }
        res.json({ message: 'Usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
});

// Eliminar (Soft Delete)
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE sys_usuarios SET activo = 0 WHERE id = ?', [id]);
        res.json({ message: 'Usuario desactivado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al desactivar usuario' });
    }
});

// --- ROLES Y PERMISOS ---

// Listar roles con sus permisos
router.get('/roles', async (req, res) => {
    try {
        const [rows]: any = await pool.query(`
            SELECT r.*, GROUP_CONCAT(p.id) as permisos_ids
            FROM sys_roles r
            LEFT JOIN sys_rol_permisos rp ON r.id = rp.rol_id
            LEFT JOIN sys_permisos p ON rp.permiso_id = p.id
            GROUP BY r.id
        `);
        res.json(rows.map((r: any) => ({
            ...r,
            permisos: r.permisos_ids ? r.permisos_ids.split(',').map(Number) : []
        })));
    } catch (err) {
        console.error('Error en /roles:', err);
        res.status(500).json({ error: 'Error al listar roles' });
    }
});

// Crear rol
router.post('/roles', async (req, res) => {
    const { nombre, descripcion, permisos } = req.body;
    try {
        const [result]: any = await pool.execute('INSERT INTO sys_roles (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion]);
        const roleId = result.insertId;

        if (permisos && Array.isArray(permisos)) {
            for (const pId of permisos) {
                await pool.execute('INSERT INTO sys_rol_permisos (rol_id, permiso_id) VALUES (?, ?)', [roleId, pId]);
            }
        }
        res.json({ id: roleId, message: 'Rol creado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al crear rol' });
    }
});

// Actualizar rol
router.put('/roles/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, permisos } = req.body;
    try {
        await pool.execute('UPDATE sys_roles SET nombre=?, descripcion=? WHERE id=?', [nombre, descripcion, id]);
        
        if (permisos && Array.isArray(permisos)) {
            await pool.execute('DELETE FROM sys_rol_permisos WHERE rol_id = ?', [id]);
            for (const pId of permisos) {
                await pool.execute('INSERT INTO sys_rol_permisos (rol_id, permiso_id) VALUES (?, ?)', [id, pId]);
            }
        }
        res.json({ message: 'Rol actualizado' });
    } catch (err) {
        res.status(500).json({ error: 'Error al actualizar rol' });
    }
});

// Listar catálogo de permisos
router.get('/permissions', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM sys_permisos WHERE activo = 1 ORDER BY codigo');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Error al listar permisos' });
    }
});

export default router;
