const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAuth } = require('../middlewares/authMiddleware');

// La clave pública se puede obtener para inicializar el Service Worker
router.get('/vapid-key', notificationController.obtenerVapidKey);

router.use(requireAuth);

router.get('/', notificationController.obtenerNotificaciones);
router.patch('/:id/leida', notificationController.marcarLeida);
router.post('/marcar-todas', notificationController.marcarTodasLeidas);
router.post('/sincronizar', notificationController.sincronizarAlertas);
router.post('/suscribir', notificationController.suscribirPush);
router.post('/probar', notificationController.probarPush);

module.exports = router;
