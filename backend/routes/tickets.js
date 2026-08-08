const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// POST /api/tickets/sell (Taquillero o Administrador)
router.post('/sell', verifyToken, requireRole(['taquillero', 'administrador']), async (req, res) => {
  const { funcion_id, asiento_ids, comprador, promo_codigo } = req.body;
  const usuario_id = req.user.id; // Empleado logueado

  if (!funcion_id || !asiento_ids || !Array.isArray(asiento_ids) || asiento_ids.length === 0 || !comprador) {
    return res.status(400).json({ error: 'Falta información requerida para procesar la venta.' });
  }

  try {
    // Llamar a la función almacenada fn_comprar_boletos
    const result = await db.query(
      'SELECT * FROM fn_comprar_boletos($1, $2, $3, $4, $5)',
      [funcion_id, asiento_ids, usuario_id, comprador.trim(), promo_codigo ? promo_codigo.trim() : null]
    );

    // Obtener detalles adicionales de los boletos para imprimir/mostrar
    const boletosIds = result.rows.map(r => r.id);
    const details = await db.query(`
      SELECT 
        b.codigo_unico,
        b.comprador,
        b.precio_original,
        b.precio_pagado,
        b.fecha_expedicion,
        b.estado,
        a.etiqueta AS asiento_etiqueta,
        ta.nombre AS tipo_asiento,
        p.titulo AS pelicula_titulo,
        s.nombre AS sala_nombre,
        f.fecha AS funcion_fecha,
        f.hora AS funcion_hora,
        u.nombre AS vendedor_nombre
      FROM boletos b
      JOIN asientos a ON b.asiento_id = a.id
      JOIN tipos_asiento ta ON a.tipo_id = ta.id
      JOIN funciones f ON b.funcion_id = f.id
      JOIN peliculas p ON f.pelicula_id = p.id
      JOIN salas s ON f.sala_id = s.id
      JOIN usuarios u ON b.usuario_id = u.id
      WHERE b.id = ANY($1)
    `, [boletosIds]);

    res.status(201).json({
      message: 'Venta de boletos procesada correctamente.',
      boletos: details.rows
    });
  } catch (err) {
    console.error('Error al vender boletos:', err);
    
    // Capturar excepciones personalizadas lanzadas por PostgreSQL (triggers o funciones)
    let errorMessage = 'Error al procesar la venta de boletos.';
    if (err.message) {
      errorMessage = err.message;
    }
    res.status(400).json({ error: errorMessage });
  }
});

// POST /api/tickets/cancel (Taquillero o Administrador)
router.post('/cancel', verifyToken, requireRole(['taquillero', 'administrador']), async (req, res) => {
  const { codigo_boleto } = req.body;

  if (!codigo_boleto) {
    return res.status(400).json({ error: 'El código de boleto es requerido.' });
  }

  try {
    // Llamar a la función fn_cancelar_boleto
    await db.query('SELECT fn_cancelar_boleto($1)', [codigo_boleto.trim().toUpperCase()]);
    
    res.json({ message: 'Boleto cancelado correctamente. El asiento ha sido liberado.' });
  } catch (err) {
    console.error('Error al cancelar boleto:', err);
    let errorMessage = 'Error al procesar la cancelación.';
    if (err.message) {
      errorMessage = err.message;
    }
    res.status(400).json({ error: errorMessage });
  }
});

// GET /api/tickets/search/:code (Búsqueda de boleto para ver detalles antes/después de cancelar)
router.get('/search/:code', verifyToken, async (req, res) => {
  const { code } = req.params;

  try {
    const result = await db.query(`
      SELECT 
        b.codigo_unico,
        b.comprador,
        b.precio_original,
        b.precio_pagado,
        b.fecha_expedicion,
        b.estado,
        a.etiqueta AS asiento_etiqueta,
        ta.nombre AS tipo_asiento,
        p.titulo AS pelicula_titulo,
        s.nombre AS sala_nombre,
        f.fecha AS funcion_fecha,
        f.hora AS funcion_hora,
        u.nombre AS vendedor_nombre
      FROM boletos b
      JOIN asientos a ON b.asiento_id = a.id
      JOIN tipos_asiento ta ON a.tipo_id = ta.id
      JOIN funciones f ON b.funcion_id = f.id
      JOIN peliculas p ON f.pelicula_id = p.id
      JOIN salas s ON f.sala_id = s.id
      JOIN usuarios u ON b.usuario_id = u.id
      WHERE b.codigo_unico = $1
    `, [code.trim().toUpperCase()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Boleto no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al buscar boleto:', err);
    res.status(500).json({ error: 'Error al buscar el boleto.' });
  }
});

module.exports = router;
