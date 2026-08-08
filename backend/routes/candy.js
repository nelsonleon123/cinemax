const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireAdmin, requireRole } = require('../middleware/auth');

// GET /api/candy/products (Acceso para todos)
router.get('/products', verifyToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM productos_dulceria ORDER BY nombre ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener productos de dulcería:', err);
    res.status(500).json({ error: 'Error al obtener los productos.' });
  }
});

// POST /api/candy/products (Solo admin)
router.post('/products', verifyToken, requireAdmin, async (req, res) => {
  const { nombre, precio, imagen_url } = req.body;

  if (!nombre || !precio || !imagen_url) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO productos_dulceria (nombre, precio, imagen_url) VALUES ($1, $2, $3) RETURNING *',
      [nombre.trim(), parseFloat(precio), imagen_url.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear producto de dulcería:', err);
    res.status(500).json({ error: 'Error al registrar el producto.' });
  }
});

// PUT /api/candy/products/:id (Solo admin)
router.put('/products/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, imagen_url } = req.body;

  if (!nombre || !precio || !imagen_url) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await db.query(
      'UPDATE productos_dulceria SET nombre = $1, precio = $2, imagen_url = $3 WHERE id = $4 RETURNING *',
      [nombre.trim(), parseFloat(precio), imagen_url.trim(), id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar producto de dulcería:', err);
    res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

// DELETE /api/candy/products/:id (Solo admin)
router.delete('/products/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM productos_dulceria WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    res.json({ message: 'Producto eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar producto de dulcería:', err);
    res.status(500).json({ error: 'No se puede eliminar el producto porque tiene ventas asociadas.' });
  }
});

// POST /api/candy/sell (Taquillero o Administrador)
router.post('/sell', verifyToken, requireRole(['taquillero', 'administrador']), async (req, res) => {
  const { comprador, productos } = req.body;
  const usuario_id = req.user.id; // Empleado logueado

  if (!comprador || !productos || !Array.isArray(productos) || productos.length === 0) {
    return res.status(400).json({ error: 'Información incompleta para registrar la venta.' });
  }

  try {
    // Convertir productos a JSON string
    const productosJson = JSON.stringify(productos);

    // Invocar función almacenada en Postgres
    const result = await db.query(
      'SELECT fn_vender_dulceria($1, $2, $3::jsonb) AS venta_id',
      [usuario_id, comprador.trim(), productosJson]
    );

    const ventaId = result.rows[0].venta_id;

    // Obtener detalles de la transacción para responder con el recibo completo
    const receipt = await db.query(`
      SELECT 
        v.id,
        v.codigo_unico,
        v.comprador,
        v.total,
        v.fecha_venta,
        u.nombre AS vendedor_nombre,
        json_agg(
          json_build_object(
            'producto_nombre', p.nombre,
            'cantidad', d.cantidad,
            'precio_unitario', d.precio_unitario,
            'subtotal', d.cantidad * d.precio_unitario
          )
        ) AS items
      FROM ventas_dulceria v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN detalle_venta_dulceria d ON d.venta_id = v.id
      JOIN productos_dulceria p ON d.producto_id = p.id
      WHERE v.id = $1
      GROUP BY v.id, u.nombre
    `, [ventaId]);

    res.status(201).json({
      message: 'Venta de dulcería registrada exitosamente.',
      venta: receipt.rows[0]
    });
  } catch (err) {
    console.error('Error al realizar venta de dulcería:', err);
    let errorMessage = 'Error al registrar la venta en la dulcería.';
    if (err.message) {
      errorMessage = err.message;
    }
    res.status(400).json({ error: errorMessage });
  }
});

module.exports = router;
