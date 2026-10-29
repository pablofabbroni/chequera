const { getPool } = require('../config/db');
const { sendPushToAll } = require('./pushService');

/**
 * Calcula métricas de vencimiento para un cheque dado
 */
function calcularMetricasCheque(cheque, hoy = new Date()) {
  const hoyMs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
  
  const fCobro = new Date(cheque.fecha_cobro);
  const fCobroMs = new Date(fCobro.getFullYear(), fCobro.getMonth(), fCobro.getDate()).getTime();

  // Vencimiento legal: exactamente 30 días posteriores a la fecha de cobro
  const fVencLegalMs = fCobroMs + (30 * 24 * 60 * 60 * 1000);
  const fVencLegal = new Date(fVencLegalMs);

  const msPorDia = 24 * 60 * 60 * 1000;
  const diasParaCobro = Math.round((fCobroMs - hoyMs) / msPorDia);
  const diasParaVencLegal = Math.round((fVencLegalMs - hoyMs) / msPorDia);

  let nivelAlerta = 'NORMAL'; // NORMAL | COBRO_CERCANO | POR_VENCER_LEGAL | VENCIDO
  let mensajeAlerta = null;

  if (cheque.estado === 'Pendiente') {
    if (diasParaVencLegal < 0) {
      nivelAlerta = 'VENCIDO';
      mensajeAlerta = `Cheque vencido legalmente hace ${Math.abs(diasParaVencLegal)} día(s).`;
    } else if (diasParaVencLegal <= 5) {
      nivelAlerta = 'POR_VENCER_LEGAL';
      mensajeAlerta = `¡URGENTE! Faltan solo ${diasParaVencLegal} día(s) para vencer su plazo legal de 30 días.`;
    } else if (diasParaCobro <= 0) {
      nivelAlerta = 'LISTO_COBRO';
      mensajeAlerta = diasParaCobro === 0 ? 'Fecha de cobro HOY.' : `Listo para cobrar (pasaron ${Math.abs(diasParaCobro)} días desde fecha de cobro).`;
    } else if (diasParaCobro <= 3) {
      nivelAlerta = 'COBRO_CERCANO';
      mensajeAlerta = `Fecha de cobro en ${diasParaCobro} día(s).`;
    }
  }

  return {
    fechaVencimientoLegal: fVencLegal.toISOString().split('T')[0],
    diasParaCobro,
    diasParaVencLegal,
    nivelAlerta,
    mensajeAlerta
  };
}

/**
 * Procesa todos los cheques pendientes y genera notificaciones internas y Push
 */
async function procesarAlertasAutomaticas() {
  try {
    const pool = getPool();
    const [cheques] = await pool.query(
      "SELECT * FROM cheques WHERE estado = 'Pendiente'"
    );

    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0];

    for (const ch of cheques) {
      const metricas = calcularMetricasCheque(ch, hoy);

      // Alerta Crítica: A 5 días o menos del vencimiento legal de 30 días
      if (metricas.nivelAlerta === 'POR_VENCER_LEGAL') {
        const titulo = `⚠️ ALERTA CRÍTICA: Cheque N° ${ch.numero} por vencer legalmente`;
        const mensaje = `El cheque de ${ch.banco} por $${Number(ch.importe).toLocaleString('es-AR')} vence legalmente en ${metricas.diasParaVencLegal} días (plazo de 30 días).`;

        // Evitar generar la misma notificación en el mismo día
        const [existente] = await pool.query(
          "SELECT id FROM notificaciones WHERE cheque_id = ? AND tipo = 'POR_VENCER_LEGAL' AND DATE(created_at) = ?",
          [ch.id, hoyStr]
        );

        if (existente.length === 0) {
          await pool.query(
            "INSERT INTO notificaciones (cheque_id, tipo, titulo, mensaje) VALUES (?, 'POR_VENCER_LEGAL', ?, ?)",
            [ch.id, titulo, mensaje]
          );

          // Disparar Notificación Push al celular
          await sendPushToAll({
            title: titulo,
            body: mensaje,
            icon: '/icons/icon-192.png',
            data: { url: '/#cartera', chequeId: ch.id }
          });
        }
      }

      // Alerta de cobro cercano: fecha de cobro hoy o en 1 a 3 días
      if (metricas.diasParaCobro >= 0 && metricas.diasParaCobro <= 3) {
        const titulo = metricas.diasParaCobro === 0 
          ? `💰 Cobro disponible HOY: Cheque N° ${ch.numero}`
          : `📅 Cobro cercano en ${metricas.diasParaCobro} días: Cheque N° ${ch.numero}`;
        
        const mensaje = `${ch.banco} - Importe: $${Number(ch.importe).toLocaleString('es-AR')} | Emisor: ${ch.emisor}`;

        const [existente] = await pool.query(
          "SELECT id FROM notificaciones WHERE cheque_id = ? AND tipo = 'COBRO_CERCANO' AND DATE(created_at) = ?",
          [ch.id, hoyStr]
        );

        if (existente.length === 0) {
          await pool.query(
            "INSERT INTO notificaciones (cheque_id, tipo, titulo, mensaje) VALUES (?, 'COBRO_CERCANO', ?, ?)",
            [ch.id, titulo, mensaje]
          );

          await sendPushToAll({
            title: titulo,
            body: mensaje,
            icon: '/icons/icon-192.png',
            data: { url: '/#cartera', chequeId: ch.id }
          });
        }
      }
    }
  } catch (error) {
    console.error('[ALERT SERVICE] Error procesando alertas:', error.message);
  }
}

module.exports = {
  calcularMetricasCheque,
  procesarAlertasAutomaticas
};
