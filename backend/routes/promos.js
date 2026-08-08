const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// GET /api/promos (Acceso para todos)
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM promociones ORDER BY codigo ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener promociones:', err);
    res.status(500).json({ error: 'Error al obtener las promociones.' });
  }
});

// GET /api/promos/validate/:code (Para validar promo en pantalla antes de pagar)
router.get('/validate/:code', verifyToken, async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(
      `SELECT id, codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, activa 
       FROM promociones 
       WHERE codigo = UPPER($1) 
         AND activa = TRUE 
         AND CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin`,
      [code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Código de promoción inválido, inactivo o expirado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al validar promoción:', err);
    res.status(500).json({ error: 'Error al validar el código de promoción.' });
  }
});

// POST /api/promos (Solo admin)
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  const { codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin } = req.body;

  if (!codigo || !descripcion || !tipo || !valor || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      `INSERT INTO promociones (codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, activa)
       VALUES (UPPER($1), $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [codigo.trim(), descripcion.trim(), tipo, parseFloat(valor), fecha_inicio, fecha_fin]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear promoción:', err);
    res.status(500).json({ error: 'Error al registrar la promoción. El código podría estar duplicado.' });
  }
});

// PUT /api/promos/:id (Solo admin)
router.put('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, activa } = req.body;

  if (!codigo || !descripcion || !tipo || !valor || !fecha_inicio || !fecha_fin || activa === undefined) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      `UPDATE promociones 
       SET codigo = UPPER($1), descripcion = $2, tipo = $3, valor = $4, fecha_inicio = $5, fecha_fin = $6, activa = $7 
       WHERE id = $8 RETURNING *`,
      [codigo.trim(), descripcion.trim(), tipo, parseFloat(valor), fecha_inicio, fecha_fin, activa, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promoción no encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar promoción:', err);
    res.status(500).json({ error: 'Error al actualizar la promoción.' });
  }
});

// DELETE /api/promos/:id (Solo admin)
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM promociones WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Promoción no encontrada.' });
    }

    res.json({ message: 'Promoción eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar promoción:', err);
    res.status(500).json({ error: 'No se puede eliminar la promoción porque ya ha sido aplicada a boletos.' });
  }
});

module.exports = router;
