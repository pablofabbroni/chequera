const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'cheques_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true
};

let pool = null;

async function initDB() {
  try {
    // 1. Conexión inicial sin base de datos para asegurar su existencia
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await tempConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await tempConnection.end();

    // 2. Crear el pool principal
    pool = mysql.createPool(dbConfig);

    // 3. Crear tablas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        rol ENUM('admin', 'operador') DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id INT AUTO_INCREMENT PRIMARY KEY,
        numero VARCHAR(50) NOT NULL,
        banco VARCHAR(100) NOT NULL,
        emisor VARCHAR(150) NOT NULL,
        entregador VARCHAR(150) NOT NULL,
        fecha_recepcion DATE NOT NULL,
        fecha_cobro DATE NOT NULL,
        importe DECIMAL(15, 2) NOT NULL,
        tasa_interes DECIMAL(8, 2) NOT NULL,
        interes_cobrado DECIMAL(15, 2) NOT NULL,
        dinero_saliente DECIMAL(15, 2) NOT NULL,
        estado ENUM('Pendiente', 'Cobrado', 'Rechazado', 'Entregado') DEFAULT 'Pendiente',
        fecha_estado DATETIME NULL,
        motivo_rechazo TEXT NULL,
        notas TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_estado (estado),
        INDEX idx_fecha_cobro (fecha_cobro)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entregas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cheque_id INT NOT NULL,
        destinatario VARCHAR(150) NOT NULL,
        fecha_entrega DATE NOT NULL,
        concepto VARCHAR(255) NULL,
        notas TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cheque_id) REFERENCES cheques(id) ON DELETE CASCADE,
        INDEX idx_entrega_cheque (cheque_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cheque_id INT NULL,
        tipo ENUM('COBRO_CERCANO', 'POR_VENCER_LEGAL', 'VENCIDO', 'SISTEMA') NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        mensaje TEXT NOT NULL,
        leida BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cheque_id) REFERENCES cheques(id) ON DELETE SET NULL,
        INDEX idx_leida (leida)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Sembrar usuario administrador inicial si no existe
    const [users] = await pool.query('SELECT id FROM usuarios LIMIT 1');
    if (users.length === 0) {
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@cheques.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminName = process.env.ADMIN_NAME || 'Administrador';
      const hash = await bcrypt.hash(adminPassword, 10);

      await pool.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        [adminName, adminEmail, hash, 'admin']
      );
      console.log(`[DB] Usuario administrador creado por defecto: ${adminEmail} (Clave: ${adminPassword})`);
    }

    console.log('[DB] Conexión a MySQL exitosa y tablas inicializadas correctamente.');
    return pool;
  } catch (error) {
    console.error('[DB ERROR] Error al inicializar MySQL:', error.message);
    throw error;
  }
}

function getPool() {
  if (!pool) {
    throw new Error('La base de datos aún no ha sido inicializada.');
  }
  return pool;
}

module.exports = {
  initDB,
  getPool
};
