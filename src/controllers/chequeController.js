const xlsx = require('xlsx');
const { getPool } = require('../config/db');
const { calcularMetricasCheque } = require('../services/alertService');

/**
 * Ingresar nuevo cheque con cálculo automático de interés y dinero saliente
 */
async function crearCheque(req, res) {
  try {
    const {
      numero,
      banco,
      emisor,
      entregador,
      fecha_recepcion,
      fecha_cobro,
      importe,
      tasa_interes,
      notas
    } = req.body;

    if (!numero || !banco || !emisor || !entregador || !fecha_recepcion || !fecha_cobro) {
      return res.status(400).json({ error: 'Todos los campos obligatorios deben completarse.' });
    }

    const numImporte = parseFloat(importe);
    const numTasa = parseFloat(tasa_interes);

    if (isNaN(numImporte) || numImporte <= 0) {
      return res.status(400).json({ error: 'El importe del cheque debe ser un número mayor a cero.' });
    }

    if (isNaN(numTasa) || numTasa < 0) {
      return res.status(400).json({ error: 'La tasa de interés debe ser un número válido.' });
    }

    // Cálculos financieros precisos
    const interesCobrado = Math.round((numImporte * (numTasa / 100)) * 100) / 100;
    const dineroSaliente = Math.round((numImporte - interesCobrado) * 100) / 100;

    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO cheques 
        (numero, banco, emisor, entregador, fecha_recepcion, fecha_cobro, importe, tasa_interes, interes_cobrado, dinero_saliente, estado, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)`,
      [
        numero.trim(),
        banco.trim(),
        emisor.trim(),
        entregador.trim(),
        fecha_recepcion,
        fecha_cobro,
        numImporte,
        numTasa,
        interesCobrado,
        dineroSaliente,
        notas ? notas.trim() : null
      ]
    );

    const [nuevo] = await pool.query('SELECT * FROM cheques WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      mensaje: 'Cheque ingresado exitosamente a Cartera.',
      cheque: {
        ...nuevo[0],
        metricas: calcularMetricasCheque(nuevo[0])
      }
    });
  } catch (error) {
    console.error('[CREAR CHEQUE ERROR]', error);
    return res.status(500).json({ error: 'Error al registrar el cheque en el sistema.' });
  }
}

/**
 * Obtener cheques de la Cartera con filtros avanzados y cálculo de alertas
 */
async function obtenerCartera(req, res) {
  try {
    const { estado, banco, entregador, search, desde, hasta, soloAlertas, ordenarPor, orden } = req.query;
    const pool = getPool();

    let query = 'SELECT * FROM cheques WHERE 1=1';
    const params = [];

    // Por defecto en Cartera muestra Pendientes, o todos si se solicita 'Todos'
    if (estado && estado !== 'Todos') {
      query += ' AND estado = ?';
      params.push(estado);
    }

    if (banco) {
      query += ' AND banco LIKE ?';
      params.push(`%${banco}%`);
    }

    if (entregador) {
      query += ' AND entregador LIKE ?';
      params.push(`%${entregador}%`);
    }

    if (desde) {
      query += ' AND fecha_cobro >= ?';
      params.push(desde);
    }

    if (hasta) {
      query += ' AND fecha_cobro <= ?';
      params.push(hasta);
    }

    if (search) {
      query += ' AND (numero LIKE ? OR emisor LIKE ? OR entregador LIKE ? OR banco LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Ordenamiento seguro
    const camposValidos = ['fecha_cobro', 'fecha_recepcion', 'importe', 'numero', 'banco', 'estado'];
    const campo = camposValidos.includes(ordenarPor) ? ordenarPor : 'fecha_cobro';
    const direccion = (orden && orden.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    query += ` ORDER BY ${campo} ${direccion}`;

    const [rows] = await pool.query(query, params);

    // Adjuntar métricas de alerta a cada cheque
    let chequesConMetricas = rows.map(ch => ({
      ...ch,
      metricas: calcularMetricasCheque(ch)
    }));

    if (soloAlertas === 'true') {
      chequesConMetricas = chequesConMetricas.filter(
        ch => ch.metricas.nivelAlerta === 'POR_VENCER_LEGAL' || 
              ch.metricas.nivelAlerta === 'COBRO_CERCANO' ||
              ch.metricas.nivelAlerta === 'LISTO_COBRO' ||
              ch.metricas.nivelAlerta === 'VENCIDO'
      );
    }

    return res.json({ cheques: chequesConMetricas });
  } catch (error) {
    console.error('[OBTENER CARTERA ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar la cartera de cheques.' });
  }
}

/**
 * Obtener un cheque por ID con historial
 */
async function obtenerChequePorId(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [rows] = await pool.query('SELECT * FROM cheques WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cheque no encontrado.' });
    }

    const cheque = rows[0];
    const metricas = calcularMetricasCheque(cheque);

    let entrega = null;
    if (cheque.estado === 'Entregado') {
      const [entregaRows] = await pool.query('SELECT * FROM entregas WHERE cheque_id = ? LIMIT 1', [id]);
      if (entregaRows.length > 0) entrega = entregaRows[0];
    }

    return res.json({
      cheque: {
        ...cheque,
        metricas,
        entrega
      }
    });
  } catch (error) {
    console.error('[OBTENER CHEQUE ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar datos del cheque.' });
  }
}

/**
 * Cambiar estado de un cheque (Cobrado o Rechazado)
 */
async function cambiarEstado(req, res) {
  try {
    const { id } = req.params;
    const { nuevoEstado, motivoRechazo } = req.body;

    if (!['Pendiente', 'Cobrado', 'Rechazado'].includes(nuevoEstado)) {
      return res.status(400).json({ error: 'Estado no válido para esta acción.' });
    }

    const pool = getPool();
    const [exist] = await pool.query('SELECT * FROM cheques WHERE id = ?', [id]);
    if (exist.length === 0) {
      return res.status(404).json({ error: 'Cheque no encontrado.' });
    }

    const cheque = exist[0];
    if (cheque.estado === 'Entregado') {
      return res.status(400).json({ error: 'El cheque fue entregado. Para modificarlo primero debe revertirse la entrega.' });
    }

    await pool.query(
      `UPDATE cheques 
       SET estado = ?, motivo_rechazo = ?, fecha_estado = NOW()
       WHERE id = ?`,
      [nuevoEstado, nuevoEstado === 'Rechazado' ? (motivoRechazo || 'Rechazado por el banco') : null, id]
    );

    const [actualizado] = await pool.query('SELECT * FROM cheques WHERE id = ?', [id]);

    return res.json({
      mensaje: `Cheque marcado como "${nuevoEstado}".`,
      cheque: {
        ...actualizado[0],
        metricas: calcularMetricasCheque(actualizado[0])
      }
    });
  } catch (error) {
    console.error('[CAMBIAR ESTADO ERROR]', error);
    return res.status(500).json({ error: 'Error al cambiar estado del cheque.' });
  }
}

/**
 * Actualizar datos de un cheque
 */
async function actualizarCheque(req, res) {
  try {
    const { id } = req.params;
    const {
      numero,
      banco,
      emisor,
      entregador,
      fecha_recepcion,
      fecha_cobro,
      importe,
      tasa_interes,
      notas
    } = req.body;

    const numImporte = parseFloat(importe);
    const numTasa = parseFloat(tasa_interes);

    const interesCobrado = Math.round((numImporte * (numTasa / 100)) * 100) / 100;
    const dineroSaliente = Math.round((numImporte - interesCobrado) * 100) / 100;

    const pool = getPool();
    await pool.query(
      `UPDATE cheques 
       SET numero = ?, banco = ?, emisor = ?, entregador = ?, fecha_recepcion = ?, fecha_cobro = ?,
           importe = ?, tasa_interes = ?, interes_cobrado = ?, dinero_saliente = ?, notas = ?
       WHERE id = ?`,
      [numero, banco, emisor, entregador, fecha_recepcion, fecha_cobro, numImporte, numTasa, interesCobrado, dineroSaliente, notas, id]
    );

    const [actualizado] = await pool.query('SELECT * FROM cheques WHERE id = ?', [id]);
    return res.json({
      mensaje: 'Cheque actualizado correctamente.',
      cheque: {
        ...actualizado[0],
        metricas: calcularMetricasCheque(actualizado[0])
      }
    });
  } catch (error) {
    console.error('[ACTUALIZAR CHEQUE ERROR]', error);
    return res.status(500).json({ error: 'Error al actualizar el cheque.' });
  }
}

/**
 * Eliminar cheque
 */
async function eliminarCheque(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('DELETE FROM cheques WHERE id = ?', [id]);
    return res.json({ mensaje: 'Cheque eliminado correctamente del sistema.' });
  } catch (error) {
    console.error('[ELIMINAR CHEQUE ERROR]', error);
    return res.status(500).json({ error: 'Error al eliminar el cheque.' });
  }
}

/**
 * Exportar cartera a Excel (.xlsx)
 */
async function exportarExcel(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM cheques ORDER BY fecha_cobro ASC');

    const dataExcel = rows.map(c => {
      const metricas = calcularMetricasCheque(c);
      return {
        'N° Cheque': c.numero,
        'Banco': c.banco,
        'Emisor': c.emisor,
        'Entregador (Cliente)': c.entregador,
        'Fecha Recepción': new Date(c.fecha_recepcion).toISOString().split('T')[0],
        'Fecha Cobro': new Date(c.fecha_cobro).toISOString().split('T')[0],
        'Vencimiento Legal (30d)': metricas.fechaVencimientoLegal,
        'Importe ($)': Number(c.importe),
        'Tasa Aplicada (%)': Number(c.tasa_interes),
        'Interés Cobrado / Ganancia ($)': Number(c.interes_cobrado),
        'Dinero Saliente ($)': Number(c.dinero_saliente),
        'Estado': c.estado,
        'Estado Alerta': metricas.mensajeAlerta || 'Al día',
        'Notas': c.notas || ''
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(dataExcel);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Cartera de Cheques');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Cartera_Cheques.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('[EXPORT EXCEL ERROR]', error);
    return res.status(500).json({ error: 'Error generando el archivo Excel.' });
  }
}

module.exports = {
  crearCheque,
  obtenerCartera,
  obtenerChequePorId,
  cambiarEstado,
  actualizarCheque,
  eliminarCheque,
  exportarExcel
};
