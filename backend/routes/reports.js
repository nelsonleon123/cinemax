const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Aplicar verificación de token y rol de administrador a todas las rutas de este router
router.use(verifyToken, requireAdmin);

// GET /api/reports/movies
router.get('/movies', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM vw_ventas_por_pelicula');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reporte de películas:', err);
    res.status(500).json({ error: 'Error al obtener reporte de películas.' });
  }
});

// GET /api/reports/rooms
router.get('/rooms', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM vw_ventas_por_sala');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reporte de salas:', err);
    res.status(500).json({ error: 'Error al obtener reporte de salas.' });
  }
});

// GET /api/reports/days
router.get('/days', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM vw_ventas_por_dia');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reporte de ventas por día:', err);
    res.status(500).json({ error: 'Error al obtener reporte de ventas por día.' });
  }
});

// GET /api/reports/candy
router.get('/candy', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM vw_ventas_dulceria_por_dia');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener reporte de dulcería por día:', err);
    res.status(500).json({ error: 'Error al obtener reporte de dulcería por día.' });
  }
});

module.exports = router;
