const webpush = require('web-push');
const { getPool } = require('../config/db');
require('dotenv').config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@cheques.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function saveSubscription(subscription) {
  const pool = getPool();
  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh || '';
  const auth = subscription.keys?.auth || '';

  // Verificar si ya existe para evitar duplicados
  const [existing] = await pool.query(
    'SELECT id FROM push_subscriptions WHERE endpoint = ? LIMIT 1',
    [endpoint]
  );

  if (existing.length === 0) {
    await pool.query(
      'INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?)',
      [endpoint, p256dh, auth]
    );
  }
}

async function sendPushToAll(payload) {
  if (!publicKey || !privateKey) {
    console.warn('[PUSH] Claves VAPID no configuradas. Omitiendo push.');
    return;
  }

  const pool = getPool();
  const [subs] = await pool.query('SELECT * FROM push_subscriptions');

  const stringifiedPayload = JSON.stringify(payload);

  for (const sub of subs) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, stringifiedPayload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Suscripción inválida o expirada, eliminar de la BD
        await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
      } else {
        console.error('[PUSH ERROR] Error enviando a', sub.id, err.message);
      }
    }
  }
}

function getPublicKey() {
  return publicKey;
}

module.exports = {
  saveSubscription,
  sendPushToAll,
  getPublicKey
};
