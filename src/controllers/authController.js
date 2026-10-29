const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/db');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

async function login(req, res) {
  try {
    const { email, usuario, password } = req.body;
    const loginUser = (email || usuario || '').trim();

    if (!loginUser || !password) {
      return res.status(400).json({ error: 'Debe ingresar el usuario y la contraseña.' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT * FROM usuarios 
       WHERE LOWER(email) = LOWER(?) 
          OR LOWER(nombre) = LOWER(?) 
          OR email = CONCAT(?, '@cheques.com') 
       LIMIT 1`,
      [loginUser, loginUser, loginUser]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const tokenPayload = {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax'
    });

    return res.json({
      mensaje: 'Inicio de sesión exitoso.',
      token,
      usuario: tokenPayload
    });
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return res.status(500).json({ error: 'Error interno en el servidor.' });
  }
}

async function me(req, res) {
  try {
    return res.json({ usuario: req.user });
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener sesión.' });
  }
}

async function logout(req, res) {
  res.clearCookie('token');
  return res.json({ mensaje: 'Sesión cerrada correctamente.' });
}

module.exports = {
  login,
  me,
  logout
};
