const express = require('express');
const router = express.Router();
const bcraController = require('../controllers/bcraController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.use(requireAuth);

router.get('/entidades', bcraController.listarEntidades);
router.get('/deudores/:cuit', bcraController.consultarDeudores);
router.get('/cheques-denunciados', bcraController.consultarChequeDenunciado);

module.exports = router;

