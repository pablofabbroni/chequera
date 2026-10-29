const { getPool } = require('../config/db');
const { saveSubscription, sendPushToAll, getPublicKey } = require('../services/pushService');
const { procesarAlertasAutomaticas } = require('../services/alertService');

async function obtenerNotificaciones(req, res) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT * FROM notificaciones ORDER BY created_at DESC LIMIT 30'
    );
    const [unread] = await pool.query(
      'SELECT COUNT(*) as noLeidas FROM notificaciones WHERE leida = FALSE'
    );

    return res.json({
      noLeidas: unread[0].noLeidas,
      notificaciones: rows
    });
  } catch (error) {
    console.error('[NOTIFICACIONES ERROR]', error);
    return res.status(500).json({ error: 'Error al obtener notificaciones.' });
  }
}

async function marcarLeida(req, res) {
  try {
    const { id } = req.params;
    const pool = getPool();
    await pool.query('UPDATE notificaciones SET leida = TRUE WHERE id = ?', [id]);
    return res.json({ mensaje: 'Notificación marcada como leída.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al marcar notificación.' });
  }
}

async function marcarTodasLeidas(req, res) {
  try {
    const pool = getPool();
    await pool.query('UPDATE notificaciones SET leida = TRUE WHERE leida = FALSE');
    return res.json({ mensaje: 'Todas las notificaciones fueron marcadas como leídas.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar notificaciones.' });
  }
}

async function sincronizarAlertas(req, res) {
  try {
    await procesarAlertasAutomaticas();
    return res.json({ mensaje: 'Alertas sincronizadas correctamente.' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al sincronizar alertas.' });
  }
}

async function obtenerVapidKey(req, res) {
  return res.json({ publicKey: getPublicKey() });
}

async function suscribirPush(req, res) {
  try {
    const subscription = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Suscripción inválida.' });
    }
    await saveSubscription(subscription);
    return res.json({ mensaje: 'Dispositivo suscrito a notificaciones Push exitosamente.' });
  } catch (error) {
    console.error('[SUSCRIBIR PUSH ERROR]', error);
    return res.status(500).json({ error: 'Error al registrar suscripción push.' });
  }
}

async function probarPush(req, res) {
  try {
    await sendPushToAll({
      title: '🔔 Notificación de Prueba - Gestión de Cheques',
      body: '¡Excelente! Las notificaciones Push para el celular están funcionando correctamente.',
      icon: '/icons/icon-192.png',
      data: { url: '/#dashboard' }
    });
    return res.json({ mensaje: 'Notificación de prueba enviada a los dispositivos registrados.' });
  } catch (error) {
    console.error('[PROBAR PUSH ERROR]', error);
    return res.status(500).json({ error: 'Error enviando notificación de prueba.' });
  }
}

module.exports = {
  obtenerNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  sincronizarAlertas,
  obtenerVapidKey,
  suscribirPush,
  probarPush
};
