const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const { initDB } = require('./config/db');
const { procesarAlertasAutomaticas } = require('./services/alertService');

const authRoutes = require('./routes/authRoutes');
const chequeRoutes = require('./routes/chequeRoutes');
const entregaRoutes = require('./routes/entregaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const clienteRoutes = require('./routes/clienteRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Archivos estáticos del Frontend
app.use(express.static(path.join(__dirname, '../public')));

// Rutas de API REST
app.use('/api/auth', authRoutes);
app.use('/api/cheques', chequeRoutes);
app.use('/api/entregas', entregaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notificaciones', notificationRoutes);
app.use('/api/clientes', clienteRoutes);

// Endpoint de Salud
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Redirección SPA al index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicio del servidor y conexión a base de datos
async function startServer() {
  try {
    await initDB();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Sistema de Control de Cheques corriendo en:`);
      console.log(`👉 http://localhost:${PORT}`);
      console.log(`====================================================`);
    });

    // Procesar alertas al iniciar
    setTimeout(() => {
      procesarAlertasAutomaticas();
    }, 3000);

    // Tarea programada cada 30 minutos para verificar vencimientos de cheques
    setInterval(() => {
      procesarAlertasAutomaticas();
    }, 30 * 60 * 1000);

  } catch (error) {
    console.error('Error fatal al iniciar la aplicación:', error);
    process.exit(1);
  }
}

startServer();
