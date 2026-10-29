const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'cheques_db'
  });

  console.log('Conectado a MySQL para cargar datos de prueba...');

  // 1. Limpiar o verificar cheques
  const [existentes] = await connection.query('SELECT COUNT(*) as cant FROM cheques');
  if (existentes[0].cant > 0) {
    console.log('Ya existen cheques en la base de datos. Omitiendo seed para no duplicar.');
    await connection.end();
    return;
  }

  const hoy = new Date();

  // Función helper para sumar días a una fecha
  const sumarDias = (dias) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  };

  // Cheques de demostración
  const ejemplos = [
    {
      numero: '00481920',
      banco: 'Banco Galicia',
      emisor: 'Constructora del Plata S.A.',
      entregador: 'Martín Rodríguez',
      fecha_recepcion: sumarDias(-35),
      fecha_cobro: sumarDias(-26), // Cobrado hace 26 días. Faltan 4 días para vencer el plazo legal de 30 días! (ALERTA CRÍTICA)
      importe: 850000.00,
      tasa: 5.5,
      estado: 'Pendiente',
      notas: 'Cheque comercial por pago de materiales'
    },
    {
      numero: '00192844',
      banco: 'Banco Santander',
      emisor: 'Distribuidora Agropecuaria SRL',
      entregador: 'Luciana Gómez',
      fecha_recepcion: sumarDias(-10),
      fecha_cobro: sumarDias(2), // Cobro en 2 días (COBRO CERCANO)
      importe: 1200000.00,
      tasa: 6.0,
      estado: 'Pendiente',
      notas: 'Vence esta semana'
    },
    {
      numero: '00839211',
      banco: 'Banco BBVA',
      emisor: 'Metalúrgica San Jorge',
      entregador: 'Carlos Fernández',
      fecha_recepcion: sumarDias(-20),
      fecha_cobro: sumarDias(15), // Cobro en 15 días
      importe: 450000.00,
      tasa: 4.8,
      estado: 'Pendiente',
      notas: 'Cliente habitual'
    },
    {
      numero: '00921822',
      banco: 'Banco Macro',
      emisor: 'Transportes del Sur',
      entregador: 'Esteban Morales',
      fecha_recepcion: sumarDias(-45),
      fecha_cobro: sumarDias(-15),
      importe: 600000.00,
      tasa: 5.0,
      estado: 'Cobrado',
      notas: 'Cobrado por ventanilla sin inconvenientes'
    },
    {
      numero: '00381920',
      banco: 'Banco Nación',
      emisor: 'Cooperativa Textil',
      entregador: 'Martín Rodríguez',
      fecha_recepcion: sumarDias(-12),
      fecha_cobro: sumarDias(25),
      importe: 750000.00,
      tasa: 5.2,
      estado: 'Entregado',
      notas: 'Endosado a proveedor de repuestos'
    }
  ];

  for (const c of ejemplos) {
    const interes = Math.round((c.importe * (c.tasa / 100)) * 100) / 100;
    const saliente = Math.round((c.importe - interes) * 100) / 100;

    const [res] = await connection.query(`
      INSERT INTO cheques 
      (numero, banco, emisor, entregador, fecha_recepcion, fecha_cobro, importe, tasa_interes, interes_cobrado, dinero_saliente, estado, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [c.numero, c.banco, c.emisor, c.entregador, c.fecha_recepcion, c.fecha_cobro, c.importe, c.tasa, interes, saliente, c.estado, c.notas]);

    if (c.estado === 'Entregado') {
      await connection.query(`
        INSERT INTO entregas (cheque_id, destinatario, fecha_entrega, concepto, notas)
        VALUES (?, 'Proveedor Central Repuestos', ?, 'Pago de insumos del taller', 'Entregado con endoso')
      `, [res.insertId, sumarDias(-5)]);
    }
  }

  console.log('✅ Cheques de demostración insertados con éxito.');
  await connection.end();
}

seed().catch(err => {
  console.error('Error al ejecutar seed:', err.message);
  process.exit(1);
});
