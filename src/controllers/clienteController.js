const { getPool } = require('../config/db');

/**
 * Obtener todos los clientes con métricas de cheques operados
 */
async function obtenerClientes(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        c.telefono,
        c.email,
        c.cuit,
        c.notas,
        c.created_at,
        COUNT(ch.id) AS total_cheques,
        COALESCE(SUM(ch.importe), 0) AS total_importe,
        COALESCE(SUM(ch.interes_cobrado), 0) AS total_ganancia
      FROM clientes c
      LEFT JOIN cheques ch ON LOWER(TRIM(ch.entregador)) = LOWER(TRIM(c.nombre))
      GROUP BY c.id, c.nombre, c.telefono, c.email, c.cuit, c.notas, c.created_at
      ORDER BY c.nombre ASC
    `);

    return res.json({ clientes: rows });
  } catch (error) {
    console.error('[CLIENTES ERROR] obtenerClientes:', error);
    return res.status(500).json({ error: 'Error al obtener los clientes.' });
  }
}

/**
 * Crear un nuevo cliente (o retornar existente si coincide el nombre)
 */
async function crearCliente(req, res) {
  try {
    const { nombre, telefono, email, cuit, notas } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    const pool = getPool();
    const nombreLimpio = nombre.trim();

    // Verificar si ya existe
    const [existentes] = await pool.query(
      'SELECT * FROM clientes WHERE LOWER(TRIM(nombre)) = LOWER(?) LIMIT 1',
      [nombreLimpio]
    );

    if (existentes.length > 0) {
      return res.json({
        cliente: existentes[0],
        mensaje: 'El cliente ya se encontraba registrado.',
        yaExistia: true
      });
    }

    const [result] = await pool.query(
      `INSERT INTO clientes (nombre, telefono, email, cuit, notas)
       VALUES (?, ?, ?, ?, ?)`,
      [
        nombreLimpio,
        telefono ? telefono.trim() : null,
        email ? email.trim() : null,
        cuit ? cuit.trim() : null,
        notas ? notas.trim() : null
      ]
    );

    const nuevoCliente = {
      id: result.insertId,
      nombre: nombreLimpio,
      telefono: telefono ? telefono.trim() : null,
      email: email ? email.trim() : null,
      cuit: cuit ? cuit.trim() : null,
      notas: notas ? notas.trim() : null,
      total_cheques: 0,
      total_importe: 0,
      total_ganancia: 0
    };

    return res.status(201).json({
      cliente: nuevoCliente,
      mensaje: 'Cliente registrado exitosamente.'
    });
  } catch (error) {
    console.error('[CLIENTES ERROR] crearCliente:', error);
    return res.status(500).json({ error: 'Error al registrar el cliente.' });
  }
}

/**
 * Actualizar datos de un cliente
 */
async function actualizarCliente(req, res) {
  try {
    const { id } = req.params;
    const { nombre, telefono, email, cuit, notas } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio.' });
    }

    const pool = getPool();
    const nombreLimpio = nombre.trim();

    // Obtener cliente anterior para ver si cambió el nombre
    const [actual] = await pool.query('SELECT nombre FROM clientes WHERE id = ?', [id]);
    if (actual.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    const nombreAnterior = actual[0].nombre;

    await pool.query(
      `UPDATE clientes 
       SET nombre = ?, telefono = ?, email = ?, cuit = ?, notas = ? 
       WHERE id = ?`,
      [
        nombreLimpio,
        telefono ? telefono.trim() : null,
        email ? email.trim() : null,
        cuit ? cuit.trim() : null,
        notas ? notas.trim() : null,
        id
      ]
    );

    // Si cambió el nombre, sincronizar cheques asociados
    if (nombreAnterior.toLowerCase() !== nombreLimpio.toLowerCase()) {
      await pool.query(
        'UPDATE cheques SET entregador = ? WHERE LOWER(TRIM(entregador)) = LOWER(TRIM(?))',
        [nombreLimpio, nombreAnterior]
      );
    }

    return res.json({ mensaje: 'Cliente actualizado correctamente.' });
  } catch (error) {
    console.error('[CLIENTES ERROR] actualizarCliente:', error);
    return res.status(500).json({ error: 'Error al actualizar el cliente.' });
  }
}

/**
 * Eliminar cliente
 */
async function eliminarCliente(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [cliente] = await pool.query('SELECT nombre FROM clientes WHERE id = ?', [id]);
    if (cliente.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    await pool.query('DELETE FROM clientes WHERE id = ?', [id]);
    return res.json({ mensaje: 'Cliente eliminado correctamente.' });
  } catch (error) {
    console.error('[CLIENTES ERROR] eliminarCliente:', error);
    return res.status(500).json({ error: 'Error al eliminar el cliente.' });
  }
}

module.exports = {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente
};
