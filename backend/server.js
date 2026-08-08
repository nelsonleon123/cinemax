const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de la API
const authRoutes = require('./routes/auth');
const movieRoutes = require('./routes/movies');
const showRoutes = require('./routes/shows');
const ticketRoutes = require('./routes/tickets');
const promoRoutes = require('./routes/promos');
const candyRoutes = require('./routes/candy');
const reportRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/shows', showRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/candy', candyRoutes);
app.use('/api/reports', reportRoutes);

// Ruta por defecto para SPA (redirige a index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.stack);
  res.status(500).json({ error: 'Ha ocurrido un error en el servidor.' });
});

// Levantar servidor
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` Servidor de CINEMAX corriendo en el puerto ${PORT}`);
  console.log(` Enlace local: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
