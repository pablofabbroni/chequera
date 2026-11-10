const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

function getDBConfig() {
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '3306', 10),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, '') || 'cheques_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        decimalNumbers: true
      };
    } catch (e) {
      console.warn('[DB] No se pudo parsear DATABASE_URL, utilizando variables individuales:', e.message);
    }
  }

  return {
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
}

let pool = null;

async function initDB() {
  const dbConfig = getDBConfig();
  try {
    // 1. Intento de asegurar la existencia de la base de datos (si hay permisos)
    try {
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
    } catch (errPerm) {
      // En bases de datos gestionadas (ej. Coolify/Railway), el usuario ya tiene su BD asignada sin permisos globales de CREATE DATABASE
      console.log('[DB] Conectando directamente a la base de datos asignada:', dbConfig.database);
    }

    // 2. Crear el pool principal
    pool = mysql.createPool(dbConfig);

    // 3. Crear tabla de usuarios y asegurar usuarios iniciales (necesario antes de backfill de usuario_id)
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

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = await bcrypt.hash(adminPassword, 10);
    const [existingAdmin] = await pool.query(
      "SELECT id FROM usuarios WHERE email = 'administrador' OR email = 'admin@cheques.com' OR LOWER(nombre) = 'administrador' LIMIT 1"
    );

    let adminId;
    if (existingAdmin.length === 0) {
      const [adminRes] = await pool.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['administrador', 'admin@cheques.com', hash, 'admin']
      );
      adminId = adminRes.insertId;
      console.log(`[DB] Usuario administrador creado por defecto: administrador / admin@cheques.com (Clave: ${adminPassword})`);
    } else {
      adminId = existingAdmin[0].id;
      await pool.query(
        "UPDATE usuarios SET password = ?, nombre = 'administrador' WHERE id = ?",
        [hash, adminId]
      );
      console.log(`[DB] Usuario administrador verificado y actualizado con clave ${adminPassword}.`);
    }

    // Asegurar usuario secundario: pirucho
    const [existingPirucho] = await pool.query(
      "SELECT id FROM usuarios WHERE LOWER(nombre) = 'pirucho' OR LOWER(email) = 'pirucho@cheques.com' LIMIT 1"
    );
    if (existingPirucho.length === 0) {
      const piruchoHash = await bcrypt.hash('pirucho2026', 10);
      await pool.query(
        'INSERT INTO usuarios (nombre, email, password, rol) VALUES (?, ?, ?, ?)',
        ['pirucho', 'pirucho@cheques.com', piruchoHash, 'operador']
      );
      console.log('[DB] Usuario creado: pirucho / pirucho@cheques.com');
    }

    // 4. Crear tablas de negocio aisladas por usuario_id
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cheques (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
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
        tipo_cobro VARCHAR(30) NULL,
        tasa_descuento_banco DECIMAL(8, 2) DEFAULT 0.00,
        descuento_banco DECIMAL(15, 2) DEFAULT 0.00,
        monto_neto_cobrado DECIMAL(15, 2) NULL,
        motivo_rechazo TEXT NULL,
        notas TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_usuario (usuario_id),
        INDEX idx_estado (estado),
        INDEX idx_fecha_cobro (fecha_cobro)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migración segura para bases de datos existentes (columnas de opciones de cobro + usuario_id)
    const alterColumns = [
      "ADD COLUMN usuario_id INT NULL AFTER id",
      "ADD COLUMN tipo_cobro VARCHAR(30) NULL AFTER fecha_estado",
      "ADD COLUMN tasa_descuento_banco DECIMAL(8, 2) DEFAULT 0.00 AFTER tipo_cobro",
      "ADD COLUMN descuento_banco DECIMAL(15, 2) DEFAULT 0.00 AFTER tasa_descuento_banco",
      "ADD COLUMN monto_neto_cobrado DECIMAL(15, 2) NULL AFTER descuento_banco"
    ];
    for (const colSql of alterColumns) {
      try {
        await pool.query(`ALTER TABLE cheques ${colSql};`);
      } catch (eAlter) {
        // Ignorar si la columna ya existe
      }
    }

    await pool.query('UPDATE cheques SET usuario_id = ? WHERE usuario_id IS NULL', [adminId]);
    try {
      await pool.query('ALTER TABLE cheques MODIFY COLUMN usuario_id INT NOT NULL');
    } catch (eMod) {}
    try {
      await pool.query('ALTER TABLE cheques ADD INDEX idx_usuario (usuario_id)');
    } catch (eIdx) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        telefono VARCHAR(50) NULL,
        email VARCHAR(150) NULL,
        cuit VARCHAR(30) NULL,
        notas TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cliente_usuario_nombre (usuario_id, nombre),
        INDEX idx_clientes_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query('ALTER TABLE clientes ADD COLUMN usuario_id INT NULL AFTER id');
    } catch (eAlter) {}
    await pool.query('UPDATE clientes SET usuario_id = ? WHERE usuario_id IS NULL', [adminId]);

    // Eliminar índice único global antiguo sobre 'nombre' si existiera
    try {
      const [idxRows] = await pool.query(
        "SHOW INDEX FROM clientes WHERE Column_name = 'nombre' AND Non_unique = 0 AND Key_name != 'uq_cliente_usuario_nombre'"
      );
      for (const idx of idxRows) {
        await pool.query(`ALTER TABLE clientes DROP INDEX \`${idx.Key_name}\``);
      }
    } catch (eDropIdx) {}

    try {
      await pool.query('ALTER TABLE clientes MODIFY COLUMN usuario_id INT NOT NULL');
    } catch (eMod) {}
    try {
      await pool.query('ALTER TABLE clientes ADD UNIQUE INDEX uq_cliente_usuario_nombre (usuario_id, nombre)');
    } catch (eIdx) {}
    try {
      await pool.query('ALTER TABLE clientes ADD INDEX idx_clientes_usuario (usuario_id)');
    } catch (eIdx) {}

    // Sincronizar clientes ya existentes en cheques por usuario
    try {
      await pool.query(`
        INSERT IGNORE INTO clientes (usuario_id, nombre)
        SELECT DISTINCT usuario_id, TRIM(entregador) 
        FROM cheques 
        WHERE entregador IS NOT NULL AND TRIM(entregador) != '' AND usuario_id IS NOT NULL;
      `);
    } catch (eBackfill) {
      // Ignorar si ya están o no hay datos
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS entregas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        cheque_id INT NOT NULL,
        destinatario VARCHAR(150) NOT NULL,
        fecha_entrega DATE NOT NULL,
        concepto VARCHAR(255) NULL,
        notas TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cheque_id) REFERENCES cheques(id) ON DELETE CASCADE,
        INDEX idx_entrega_cheque (cheque_id),
        INDEX idx_entregas_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query('ALTER TABLE entregas ADD COLUMN usuario_id INT NULL AFTER id');
    } catch (eAlter) {}
    await pool.query(
      'UPDATE entregas e INNER JOIN cheques c ON e.cheque_id = c.id SET e.usuario_id = c.usuario_id WHERE e.usuario_id IS NULL'
    );
    await pool.query('UPDATE entregas SET usuario_id = ? WHERE usuario_id IS NULL', [adminId]);
    try {
      await pool.query('ALTER TABLE entregas MODIFY COLUMN usuario_id INT NOT NULL');
    } catch (eMod) {}
    try {
      await pool.query('ALTER TABLE entregas ADD INDEX idx_entregas_usuario (usuario_id)');
    } catch (eIdx) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        cheque_id INT NULL,
        tipo ENUM('COBRO_CERCANO', 'POR_VENCER_LEGAL', 'VENCIDO', 'SISTEMA') NOT NULL,
        titulo VARCHAR(200) NOT NULL,
        mensaje TEXT NOT NULL,
        leida BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cheque_id) REFERENCES cheques(id) ON DELETE SET NULL,
        INDEX idx_leida (leida),
        INDEX idx_notificaciones_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query('ALTER TABLE notificaciones ADD COLUMN usuario_id INT NULL AFTER id');
    } catch (eAlter) {}
    await pool.query(
      'UPDATE notificaciones n INNER JOIN cheques c ON n.cheque_id = c.id SET n.usuario_id = c.usuario_id WHERE n.usuario_id IS NULL'
    );
    await pool.query('UPDATE notificaciones SET usuario_id = ? WHERE usuario_id IS NULL', [adminId]);
    try {
      await pool.query('ALTER TABLE notificaciones MODIFY COLUMN usuario_id INT NOT NULL');
    } catch (eMod) {}
    try {
      await pool.query('ALTER TABLE notificaciones ADD INDEX idx_notificaciones_usuario (usuario_id)');
    } catch (eIdx) {}

    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        endpoint TEXT NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_push_usuario (usuario_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    try {
      await pool.query('ALTER TABLE push_subscriptions ADD COLUMN usuario_id INT NULL AFTER id');
    } catch (eAlter) {}
    await pool.query('UPDATE push_subscriptions SET usuario_id = ? WHERE usuario_id IS NULL', [adminId]);
    try {
      await pool.query('ALTER TABLE push_subscriptions MODIFY COLUMN usuario_id INT NOT NULL');
    } catch (eMod) {}
    try {
      await pool.query('ALTER TABLE push_subscriptions ADD INDEX idx_push_usuario (usuario_id)');
    } catch (eIdx) {}

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
