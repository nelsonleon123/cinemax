const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/shows (Acceso para todos)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        f.id,
        f.pelicula_id,
        p.titulo AS pelicula_titulo,
        p.duracion AS pelicula_duracion,
        p.imagen_url AS pelicula_imagen,
        f.sala_id,
        s.nombre AS sala_nombre,
        f.fecha,
        f.hora
      FROM funciones f
      JOIN peliculas p ON f.pelicula_id = p.id
      JOIN salas s ON f.sala_id = s.id
      ORDER BY f.fecha ASC, f.hora ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener funciones:', err);
    res.status(500).json({ error: 'Error al obtener las funciones.' });
  }
});

// GET /api/shows/rooms (Obtener salas disponibles)
router.get('/rooms', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM salas ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener salas:', err);
    res.status(500).json({ error: 'Error al obtener las salas.' });
  }
});

// POST /api/shows (Solo admin)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { pelicula_id, sala_id, fecha, hora } = req.body;

  if (!pelicula_id || !sala_id || !fecha || !hora) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO funciones (pelicula_id, sala_id, fecha, hora) VALUES ($1, $2, $3, $4) RETURNING *',
      [pelicula_id, sala_id, fecha, hora]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear función:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una función programada en esa sala, fecha y hora.' });
    }
    res.status(500).json({ error: 'Error al registrar la función.' });
  }
});

// PUT /api/shows/:id (Solo admin)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { pelicula_id, sala_id, fecha, hora } = req.body;

  if (!pelicula_id || !sala_id || !fecha || !hora) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'UPDATE funciones SET pelicula_id = $1, sala_id = $2, fecha = $3, hora = $4 WHERE id = $5 RETURNING *',
      [pelicula_id, sala_id, fecha, hora, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Función no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar función:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una función programada en esa sala, fecha y hora.' });
    }
    res.status(500).json({ error: 'Error al actualizar la función.' });
  }
});

// DELETE /api/shows/:id (Solo admin)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM funciones WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Función no encontrada.' });
    }

    res.json({ message: 'Función eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar función:', err);
    res.status(500).json({ error: 'No se puede eliminar la función porque contiene boletos vendidos.' });
  }
});

// GET /api/shows/:id/seats (Mapa de asientos con estado ocupado/libre para una función)
router.get('/:id/seats', verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Obtener información de la sala y de la función
    const funcCheck = await db.query(
      `SELECT f.id, f.sala_id, s.nombre AS sala_nombre 
       FROM funciones f 
       JOIN salas s ON f.sala_id = s.id 
       WHERE f.id = $1`, 
      [id]
    );

    if (funcCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Función no encontrada.' });
    }

    const { sala_id, sala_nombre } = funcCheck.rows[0];

    // 2. Obtener todos los asientos de esa sala con su estado de ocupación
    const result = await db.query(`
      SELECT 
        a.id AS asiento_id,
        a.fila,
        a.columna,
        a.etiqueta,
        ta.nombre AS tipo_asiento,
        ta.precio_base,
        CASE 
          WHEN b.id IS NOT NULL THEN TRUE 
          ELSE FALSE 
        END AS ocupado
      FROM asientos a
      JOIN tipos_asiento ta ON a.tipo_id = ta.id
      LEFT JOIN boletos b ON b.asiento_id = a.id AND b.funcion_id = $1 AND b.estado = 'vendido'
      WHERE a.sala_id = $2
      ORDER BY a.fila ASC, a.columna ASC
    `, [id, sala_id]);

    res.json({
      funcion_id: id,
      sala_nombre,
      asientos: result.rows
    });
  } catch (err) {
    console.error('Error al obtener mapa de asientos:', err);
    res.status(500).json({ error: 'Error al obtener el mapa de asientos.' });
  }
});

module.exports = router;
