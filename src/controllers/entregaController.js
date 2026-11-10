const { getPool } = require('../config/db');

/**
 * Entregar un cheque de la cartera a un tercero (proveedor, insumos, etc.)
 */
async function entregarCheque(req, res) {
  try {
    const { cheque_id, destinatario, fecha_entrega, concepto, notas } = req.body;

    if (!cheque_id || !destinatario || !fecha_entrega) {
      return res.status(400).json({ error: 'Debe seleccionar el cheque, indicar el destinatario y la fecha de entrega.' });
    }

    const pool = getPool();
    const usuarioId = req.user.id;

    // Validar estado del cheque perteneciente al usuario
    const [chequeRows] = await pool.query('SELECT * FROM cheques WHERE id = ? AND usuario_id = ?', [cheque_id, usuarioId]);
    if (chequeRows.length === 0) {
      return res.status(404).json({ error: 'Cheque no encontrado.' });
    }

    const cheque = chequeRows[0];
    if (cheque.estado !== 'Pendiente') {
      return res.status(400).json({ 
        error: `Solo se pueden entregar cheques en estado "Pendiente". El cheque actual está en estado "${cheque.estado}".` 
      });
    }

    // Iniciar transacción de entrega
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.query(
        `INSERT INTO entregas (usuario_id, cheque_id, destinatario, fecha_entrega, concepto, notas)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [usuarioId, cheque_id, destinatario.trim(), fecha_entrega, concepto ? concepto.trim() : null, notas ? notas.trim() : null]
      );

      await connection.query(
        `UPDATE cheques 
         SET estado = 'Entregado', fecha_estado = ?
         WHERE id = ? AND usuario_id = ?`,
        [fecha_entrega, cheque_id, usuarioId]
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      mensaje: `Cheque N° ${cheque.numero} entregado exitosamente a "${destinatario}".`
    });
  } catch (error) {
    console.error('[ENTREGAR CHEQUE ERROR]', error);
    return res.status(500).json({ error: 'Error al registrar la entrega del cheque.' });
  }
}

/**
 * Obtener listado de todos los cheques entregados
 */
async function obtenerEntregados(req, res) {
  try {
    const { destinatario, search, desde, hasta } = req.query;
    const pool = getPool();
    const usuarioId = req.user.id;

    let query = `
      SELECT 
        e.id AS entrega_id,
        e.destinatario,
        e.fecha_entrega,
        e.concepto,
        e.notas AS entrega_notas,
        c.id AS cheque_id,
        c.numero,
        c.banco,
        c.emisor,
        c.entregador,
        c.fecha_recepcion,
        c.fecha_cobro,
        c.importe,
        c.tasa_interes,
        c.interes_cobrado,
        c.dinero_saliente,
        c.estado
      FROM entregas e
      INNER JOIN cheques c ON e.cheque_id = c.id
      WHERE e.usuario_id = ? AND c.usuario_id = ?
    `;
    const params = [usuarioId, usuarioId];

    if (destinatario) {
      query += ' AND e.destinatario LIKE ?';
      params.push(`%${destinatario}%`);
    }

    if (desde) {
      query += ' AND e.fecha_entrega >= ?';
      params.push(desde);
    }

    if (hasta) {
      query += ' AND e.fecha_entrega <= ?';
      params.push(hasta);
    }

    if (search) {
      query += ' AND (c.numero LIKE ? OR c.banco LIKE ? OR e.destinatario LIKE ? OR e.concepto LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY e.fecha_entrega DESC, e.id DESC';

    const [rows] = await pool.query(query, params);

    const totalImporte = rows.reduce((sum, item) => sum + Number(item.importe), 0);

    return res.json({
      totalEntregados: rows.length,
      totalImporte,
      entregados: rows
    });
  } catch (error) {
    console.error('[OBTENER ENTREGADOS ERROR]', error);
    return res.status(500).json({ error: 'Error al consultar cheques entregados.' });
  }
}

/**
 * Revertir la entrega de un cheque (volverlo a Cartera en estado Pendiente)
 */
async function revertirEntrega(req, res) {
  try {
    const { entregaId } = req.params;
    const pool = getPool();
    const usuarioId = req.user.id;

    const [entregas] = await pool.query('SELECT * FROM entregas WHERE id = ? AND usuario_id = ?', [entregaId, usuarioId]);
    if (entregas.length === 0) {
      return res.status(404).json({ error: 'Registro de entrega no encontrado.' });
    }

    const entrega = entregas[0];
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query('DELETE FROM entregas WHERE id = ? AND usuario_id = ?', [entregaId, usuarioId]);
      await connection.query(
        "UPDATE cheques SET estado = 'Pendiente', fecha_estado = NULL WHERE id = ? AND usuario_id = ?",
        [entrega.cheque_id, usuarioId]
      );

      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }

    return res.json({ mensaje: 'Entrega cancelada. El cheque retornó a la Cartera como Pendiente.' });
  } catch (error) {
    console.error('[REVERTIR ENTREGA ERROR]', error);
    return res.status(500).json({ error: 'Error al revertir la entrega.' });
  }
}

module.exports = {
  entregarCheque,
  obtenerEntregados,
  revertirEntrega
};
