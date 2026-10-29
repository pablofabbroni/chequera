const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/metricas', dashboardController.obtenerMetricasDashboard);

module.exports = router;
