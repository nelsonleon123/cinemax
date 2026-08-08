const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/movies (Acceso para todos los autenticados)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM peliculas ORDER BY titulo ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener películas:', err);
    res.status(500).json({ error: 'Error al obtener las películas.' });
  }
});

// POST /api/movies (Solo admin)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { titulo, duracion, genero, sinopsis, imagen_url } = req.body;

  if (!titulo || !duracion || !genero || !sinopsis || !imagen_url) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO peliculas (titulo, duracion, genero, sinopsis, imagen_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [titulo.trim(), parseInt(duracion), genero.trim(), sinopsis.trim(), imagen_url.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear película:', err);
    res.status(500).json({ error: 'Error al registrar la película.' });
  }
});

// PUT /api/movies/:id (Solo admin)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, duracion, genero, sinopsis, imagen_url } = req.body;

  if (!titulo || !duracion || !genero || !sinopsis || !imagen_url) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'UPDATE peliculas SET titulo = $1, duracion = $2, genero = $3, sinopsis = $4, imagen_url = $5 WHERE id = $6 RETURNING *',
      [titulo.trim(), parseInt(duracion), genero.trim(), sinopsis.trim(), imagen_url.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Película no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar película:', err);
    res.status(500).json({ error: 'Error al actualizar la película.' });
  }
});

// DELETE /api/movies/:id (Solo admin)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM peliculas WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Película no encontrada.' });
    }

    res.json({ message: 'Película eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar película:', err);
    res.status(500).json({ error: 'No se puede eliminar la película porque tiene funciones asociadas.' });
  }
});

module.exports = router;
