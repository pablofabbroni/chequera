const bcraService = require('../services/bcraService');

async function listarEntidades(req, res) {
  try {
    const data = await bcraService.obtenerEntidades();
    return res.json(data);
  } catch (error) {
    console.error('[BCRA ENTIDADES ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar entidades del BCRA.' });
  }
}

async function consultarDeudores(req, res) {
  try {
    const { cuit } = req.params;
    const reporte = await bcraService.consultarCentralDeudores(cuit);
    return res.json(reporte);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[BCRA DEUDORES ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar Central de Deudores del BCRA.' });
  }
}

async function consultarChequeDenunciado(req, res) {
  try {
    const { codigoEntidad, banco, numeroCheque } = req.query;
    const resultado = await bcraService.consultarChequeDenunciado({
      codigoEntidad,
      banco,
      numeroCheque
    });
    return res.json(resultado);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('[BCRA CHEQUES DENUNCIADOS ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar Cheques Denunciados del BCRA.' });
  }
}

module.exports = {
  listarEntidades,
  consultarDeudores,
  consultarChequeDenunciado
};

