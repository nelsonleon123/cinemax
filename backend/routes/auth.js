const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM fn_verificar_login($1, $2)',
      [username.trim(), password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo.' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol },
      process.env.JWT_SECRET || 'cinemax_secret_key_sena_2026',
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/employees (Solo admin)
router.post('/employees', verifyToken, requireAdmin, async (req, res) => {
  const { username, password, nombre, rol } = req.body;

  if (!username || !password || !nombre || !rol) {
    return res.status(400).json({ error: 'Todos los campos son requeridos.' });
  }

  try {
    // Verificar si el usuario ya existe
    const checkUser = await db.query('SELECT 1 FROM usuarios WHERE username = $1', [username.trim()]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }

    const result = await db.query(
      'SELECT fn_crear_usuario($1, $2, $3, $4) AS id',
      [username.trim(), password, nombre.trim(), rol]
    );

    res.status(201).json({
      message: 'Empleado creado exitosamente.',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Error al crear empleado:', err);
    res.status(500).json({ error: 'Error al registrar el empleado en la base de datos.' });
  }
});

// GET /api/auth/employees (Solo admin)
router.get('/employees', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, nombre, rol, activo FROM usuarios ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener empleados:', err);
    res.status(500).json({ error: 'Error al obtener los empleados.' });
  }
});

// PUT /api/auth/employees/:id/toggle (Solo admin)
router.put('/employees/:id/toggle', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener estado actual
    const check = await db.query('SELECT activo, username FROM usuarios WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Evitar que el admin se desactive a sí mismo
    if (check.rows[0].username === req.user.username) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    }

    const nuevoEstado = !check.rows[0].activo;
    await db.query('UPDATE usuarios SET activo = $1 WHERE id = $2', [nuevoEstado, id]);

    res.json({ message: `Empleado ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`, activo: nuevoEstado });
  } catch (err) {
    console.error('Error al alternar estado de empleado:', err);
    res.status(500).json({ error: 'Error al actualizar el estado del empleado.' });
  }
});

module.exports = router;
