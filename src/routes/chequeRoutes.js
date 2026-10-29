const express = require('express');
const router = express.Router();
const chequeController = require('../controllers/chequeController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.post('/', chequeController.crearCheque);
router.get('/', chequeController.obtenerCartera);
router.get('/exportar/excel', chequeController.exportarExcel);
router.post('/limpiar-duplicados', chequeController.limpiarDuplicados);
router.get('/:id', chequeController.obtenerChequePorId);
router.put('/:id', chequeController.actualizarCheque);
router.patch('/:id/estado', chequeController.cambiarEstado);
router.delete('/:id', chequeController.eliminarCheque);

module.exports = router;
