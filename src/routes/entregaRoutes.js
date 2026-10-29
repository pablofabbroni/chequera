const express = require('express');
const router = express.Router();
const entregaController = require('../controllers/entregaController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.post('/', entregaController.entregarCheque);
router.get('/', entregaController.obtenerEntregados);
router.delete('/:entregaId', entregaController.revertirEntrega);

module.exports = router;
