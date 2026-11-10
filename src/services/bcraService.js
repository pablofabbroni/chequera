const BCRA_BASE_URL = 'https://api.bcra.gob.ar';
const REQUEST_TIMEOUT_MS = 8500;
const ENTIDADES_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

// Alias de bancos habituales del sistema hacia los códigos oficiales de entidad del BCRA
const ALIAS_BANCOS_BCRA = {
  'banco galicia': 7,
  'galicia': 7,
  'banco santander': 72,
  'santander': 72,
  'banco bbva': 17,
  'bbva': 17,
  'banco macro': 285,
  'macro': 285,
  'banco nacion': 11,
  'nacion': 11,
  'banco provincia': 14,
  'provincia': 14,
  'banco ciudad': 29,
  'ciudad': 29,
  'banco credicoop': 191,
  'credicoop': 191,
  'banco icbc': 15,
  'icbc': 15,
  'banco hsbc': 150,
  'hsbc': 150,
  'banco patagonia': 34,
  'patagonia': 34,
  'banco supervielle': 27,
  'supervielle': 27,
  'banco comafi': 299,
  'comafi': 299
};

// Fallback estático por si BCRA /entidades demora en responder en frío
const ENTIDADES_FALLBACK = [
  { codigoEntidad: 7, denominacion: 'BANCO DE GALICIA Y BUENOS AIRES S.A.' },
  { codigoEntidad: 72, denominacion: 'BANCO SANTANDER ARGENTINA S.A.' },
  { codigoEntidad: 17, denominacion: 'BANCO BBVA ARGENTINA S.A.' },
  { codigoEntidad: 285, denominacion: 'BANCO MACRO S.A.' },
  { codigoEntidad: 11, denominacion: 'BANCO DE LA NACION ARGENTINA' },
  { codigoEntidad: 14, denominacion: 'BANCO DE LA PROVINCIA DE BUENOS AIRES' },
  { codigoEntidad: 29, denominacion: 'BANCO DE LA CIUDAD DE BUENOS AIRES' },
  { codigoEntidad: 191, denominacion: 'BANCO CREDICOOP COOPERATIVO LIMITADO' },
  { codigoEntidad: 15, denominacion: 'INDUSTRIAL AND COMMERCIAL BANK OF CHINA' },
  { codigoEntidad: 150, denominacion: 'Banco GGAL SA' },
  { codigoEntidad: 34, denominacion: 'BANCO PATAGONIA S.A.' },
  { codigoEntidad: 27, denominacion: 'BANCO SUPERVIELLE S.A.' },
  { codigoEntidad: 299, denominacion: 'BANCO COMAFI SOCIEDAD ANONIMA' },
  { codigoEntidad: 44, denominacion: 'BANCO HIPOTECARIO S.A.' },
  { codigoEntidad: 20, denominacion: 'BANCO DE LA PROVINCIA DE CORDOBA S.A.' },
  { codigoEntidad: 330, denominacion: 'NUEVO BANCO DE SANTA FE SOCIEDAD ANONIMA' },
  { codigoEntidad: 386, denominacion: 'NUEVO BANCO DE ENTRE RÍOS S.A.' },
  { codigoEntidad: 311, denominacion: 'NUEVO BANCO DEL CHACO S. A.' }
];

const SITUACIONES_DESC = {
  1: 'Situación normal',
  2: 'Con seguimiento especial / Riesgo bajo',
  3: 'Con problemas / Riesgo medio',
  4: 'Alto riesgo de insolvencia / Riesgo alto',
  5: 'Irrecuperable'
};

let cacheEntidades = {
  data: null,
  timestamp: 0
};

function normalizarTexto(txt = '') {
  return String(txt)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizarCuit(valor = '') {
  const digitos = String(valor).replace(/\D/g, '');
  if (!/^\d{11}$/.test(digitos)) {
    return null;
  }
  return digitos;
}

function formatearCuit(digitos = '') {
  const clean = String(digitos).replace(/\D/g, '');
  if (clean.length !== 11) return String(digitos);
  return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
}

async function fetchBcraJson(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CheckPro-BCRA-Client/1.0'
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    let body = null;
    try {
      body = await response.json();
    } catch (eJson) {
      body = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      data: body,
      networkError: false
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      networkError: true,
      errorMessage: error.message
    };
  }
}

/**
 * Obtiene y cachea el listado oficial de entidades bancarias del BCRA
 */
async function obtenerEntidades() {
  const ahora = Date.now();
  if (cacheEntidades.data && (ahora - cacheEntidades.timestamp) < ENTIDADES_CACHE_TTL_MS) {
    return { entidades: cacheEntidades.data, desdeCache: true };
  }

  const resp = await fetchBcraJson(`${BCRA_BASE_URL}/cheques/v1.0/entidades`);
  if (resp.ok && Array.isArray(resp.data?.results)) {
    const limpias = resp.data.results
      .map(e => ({
        codigoEntidad: Number(e.codigoEntidad),
        denominacion: String(e.denominacion || '').trim().replace(/\s+/g, ' ')
      }))
      .filter(e => !isNaN(e.codigoEntidad) && e.denominacion)
      .sort((a, b) => a.denominacion.localeCompare(b.denominacion, 'es'));

    cacheEntidades = {
      data: limpias,
      timestamp: ahora
    };
    return { entidades: limpias, desdeCache: false };
  }

  return {
    entidades: cacheEntidades.data || ENTIDADES_FALLBACK,
    fallback: true
  };
}

/**
 * Resuelve el código oficial BCRA de una entidad a partir de un código o nombre de banco
 */
async function resolverCodigoEntidad(nombreBanco, codigoExplicito = null) {
  if (codigoExplicito !== null && codigoExplicito !== undefined && String(codigoExplicito).trim() !== '') {
    const num = parseInt(codigoExplicito, 10);
    if (!isNaN(num) && num > 0) return num;
  }

  const norm = normalizarTexto(nombreBanco);
  if (!norm) return null;

  if (ALIAS_BANCOS_BCRA[norm]) {
    return ALIAS_BANCOS_BCRA[norm];
  }

  const { entidades } = await obtenerEntidades();
  const exacta = entidades.find(e => normalizarTexto(e.denominacion) === norm);
  if (exacta) return exacta.codigoEntidad;

  const parcial = entidades.find(e => normalizarTexto(e.denominacion).includes(norm) || norm.includes(normalizarTexto(e.denominacion)));
  return parcial ? parcial.codigoEntidad : null;
}

/**
 * Consulta consolidada en Central de Deudores BCRA:
 *  - Situación actual (/Deudas/{cuit})
 *  - Historial 24 meses (/Deudas/Historicas/{cuit})
 *  - Cheques rechazados (/Deudas/ChequesRechazados/{cuit})
 */
async function consultarCentralDeudores(cuitRaw) {
  const cuit = normalizarCuit(cuitRaw);
  if (!cuit) {
    const err = new Error('El CUIT / CUIL / CDI debe tener exactamente 11 dígitos numéricos.');
    err.statusCode = 400;
    throw err;
  }

  const [respDeudas, respHistoricas, respRechazados] = await Promise.all([
    fetchBcraJson(`${BCRA_BASE_URL}/CentralDeDeudores/v1.0/Deudas/${cuit}`),
    fetchBcraJson(`${BCRA_BASE_URL}/CentralDeDeudores/v1.0/Deudas/Historicas/${cuit}`),
    fetchBcraJson(`${BCRA_BASE_URL}/CentralDeDeudores/v1.0/Deudas/ChequesRechazados/${cuit}`)
  ]);

  const disponibleDeudas = !respDeudas.networkError && (respDeudas.status === 200 || respDeudas.status === 404);
  const disponibleHistoricas = !respHistoricas.networkError && (respHistoricas.status === 200 || respHistoricas.status === 404);
  const disponibleRechazados = !respRechazados.networkError && (respRechazados.status === 200 || respRechazados.status === 404);

  const servicioDisponible = disponibleDeudas || disponibleRechazados;

  const deudasResult = respDeudas.status === 200 ? respDeudas.data?.results || null : null;
  const historicasResult = respHistoricas.status === 200 ? respHistoricas.data?.results || null : null;
  const rechazadosResult = respRechazados.status === 200 ? respRechazados.data?.results || null : null;

  const denominacion =
    deudasResult?.denominacion ||
    rechazadosResult?.denominacion ||
    historicasResult?.denominacion ||
    null;

  // Procesar último período de deudas (monto en BCRA viene en miles de pesos)
  const ultimoPeriodoObj = Array.isArray(deudasResult?.periodos) && deudasResult.periodos.length > 0
    ? deudasResult.periodos[0]
    : null;

  const entidadesActuales = (ultimoPeriodoObj?.entidades || []).map(ent => {
    const montoMiles = Number(ent.monto) || 0;
    const montoPesos = Math.round(montoMiles * 1000 * 100) / 100;
    const sit = Number(ent.situacion) || 1;
    return {
      entidad: ent.entidad,
      situacion: sit,
      situacionDescripcion: SITUACIONES_DESC[sit] || `Situación ${sit}`,
      fechaSit1: ent.fechaSit1 || null,
      montoMiles,
      montoPesos,
      diasAtrasoPago: Number(ent.diasAtrasoPago) || 0,
      refinanciaciones: Boolean(ent.refinanciaciones),
      recategorizacionOblig: Boolean(ent.recategorizacionOblig),
      situacionJuridica: Boolean(ent.situacionJuridica),
      irrecDisposicionTecnica: Boolean(ent.irrecDisposicionTecnica),
      enRevision: Boolean(ent.enRevision),
      procesoJud: Boolean(ent.procesoJud)
    };
  });

  // Procesar historial 24 meses (resumen por período)
  const historialPeriodos = (historicasResult?.periodos || []).map(p => {
    const ents = (p.entidades || []).map(e => ({
      entidad: e.entidad,
      situacion: Number(e.situacion) || 1,
      situacionDescripcion: SITUACIONES_DESC[Number(e.situacion)] || `Situación ${e.situacion}`,
      montoMiles: Number(e.monto) || 0,
      montoPesos: Math.round((Number(e.monto) || 0) * 1000 * 100) / 100,
      enRevision: Boolean(e.enRevision),
      procesoJud: Boolean(e.procesoJud)
    }));
    const peorSit = ents.reduce((max, e) => Math.max(max, e.situacion), 0);
    const totalPesos = ents.reduce((sum, e) => sum + e.montoPesos, 0);
    return {
      periodo: p.periodo,
      peorSituacion: peorSit,
      totalPesos,
      entidades: ents
    };
  });

  // Procesar cheques rechazados del CUIT
  const chequesRechazadosLista = [];
  for (const causalGroup of (rechazadosResult?.causales || [])) {
    const causal = causalGroup.causal || 'SIN ESPECIFICAR';
    for (const entGroup of (causalGroup.entidades || [])) {
      const entidadCod = entGroup.entidad;
      for (const det of (entGroup.detalle || [])) {
        chequesRechazadosLista.push({
          causal,
          entidad: entidadCod,
          nroCheque: det.nroCheque,
          fechaRechazo: det.fechaRechazo || null,
          monto: Number(det.monto) || 0,
          fechaPago: det.fechaPago || null,
          fechaPagoMulta: det.fechaPagoMulta || null,
          estadoMulta: det.estadoMulta || null,
          ctaPersonal: Boolean(det.ctaPersonal),
          denomJuridica: det.denomJuridica || null,
          enRevision: Boolean(det.enRevision),
          procesoJud: Boolean(det.procesoJud)
        });
      }
    }
  }

  // Ordenar rechazados por fecha más reciente
  chequesRechazadosLista.sort((a, b) => String(b.fechaRechazo || '').localeCompare(String(a.fechaRechazo || '')));

  // Construir evaluación consolidada de riesgo y alertas
  const alertas = [];
  let peorSituacion = 0;
  let totalDeudaPesos = 0;
  let maxDiasAtraso = 0;
  let tieneSituacionJuridica = false;
  let tieneProcesoJudicial = false;
  let tieneRefinanciacion = false;
  let tieneIrrecuperableTec = false;
  let tieneEnRevision = false;

  for (const e of entidadesActuales) {
    if (e.situacion > peorSituacion) peorSituacion = e.situacion;
    totalDeudaPesos += e.montoPesos;
    if (e.diasAtrasoPago > maxDiasAtraso) maxDiasAtraso = e.diasAtrasoPago;
    if (e.situacionJuridica) tieneSituacionJuridica = true;
    if (e.procesoJud) tieneProcesoJudicial = true;
    if (e.refinanciaciones) tieneRefinanciacion = true;
    if (e.irrecDisposicionTecnica) tieneIrrecuperableTec = true;
    if (e.enRevision) tieneEnRevision = true;

    if (e.situacion >= 3) {
      alertas.push({
        severidad: 'critica',
        texto: `${e.entidad}: Situación ${e.situacion} (${e.situacionDescripcion})${e.diasAtrasoPago > 0 ? ` - ${e.diasAtrasoPago} días de atraso` : ''}.`
      });
    } else if (e.situacion === 2) {
      alertas.push({
        severidad: 'precaucion',
        texto: `${e.entidad}: Situación 2 (${e.situacionDescripcion})${e.diasAtrasoPago > 0 ? ` - ${e.diasAtrasoPago} días de atraso` : ''}.`
      });
    }
  }

  if (tieneSituacionJuridica) {
    alertas.push({
      severidad: 'critica',
      texto: 'Registra Situación Jurídica activa (concordato, concurso preventivo, quiebra o gestión judicial).'
    });
  }
  if (tieneProcesoJudicial) {
    alertas.push({
      severidad: 'critica',
      texto: 'Registra información sometida a Proceso Judicial (Ley 25.326).'
    });
  }
  if (tieneIrrecuperableTec) {
    alertas.push({
      severidad: 'critica',
      texto: 'Clasificado como Irrecuperable por Disposición Técnica.'
    });
  }
  if (tieneRefinanciacion) {
    alertas.push({
      severidad: 'precaucion',
      texto: 'Posee financiaciones encuadradas bajo Refinanciaciones.'
    });
  }
  if (tieneEnRevision) {
    alertas.push({
      severidad: 'precaucion',
      texto: 'Posee información crediticia actualmente En Revisión.'
    });
  }

  const chequesImpagos = chequesRechazadosLista.filter(c => !c.fechaPago);
  const chequesLevantados = chequesRechazadosLista.filter(c => Boolean(c.fechaPago));
  const montoRechazadoPesos = chequesRechazadosLista.reduce((s, c) => s + c.monto, 0);
  const montoImpagoPesos = chequesImpagos.reduce((s, c) => s + c.monto, 0);
  const multasProblematicas = chequesRechazadosLista.filter(c => {
    const est = String(c.estadoMulta || '').toUpperCase();
    return est === 'IMPAGA' || est.includes('SUSPENDID');
  });

  if (chequesImpagos.length > 0) {
    alertas.push({
      severidad: 'critica',
      texto: `Registra ${chequesImpagos.length} cheque(s) rechazado(s) SIN LEVANTAR (sin fecha de pago).`
    });
  }
  if (multasProblematicas.length > 0) {
    const estados = [...new Set(multasProblematicas.map(m => m.estadoMulta))].join(', ');
    alertas.push({
      severidad: 'critica',
      texto: `Estado de multa en BCRA: ${estados}.`
    });
  }
  if (chequesLevantados.length > 0 && chequesImpagos.length === 0) {
    alertas.push({
      severidad: 'precaucion',
      texto: `Registra ${chequesLevantados.length} cheque(s) rechazado(s) histórico(s) ya levantado(s)/pagado(s).`
    });
  }

  // Nivel de semáforo general
  let nivel = 'LIMPIO';
  let titulo = 'Sin antecedentes negativos en BCRA';

  if (!servicioDisponible) {
    nivel = 'NO_DISPONIBLE';
    titulo = 'Servicio del BCRA no disponible temporalmente';
  } else if (
    peorSituacion >= 3 ||
    tieneSituacionJuridica ||
    tieneProcesoJudicial ||
    tieneIrrecuperableTec ||
    chequesImpagos.length > 0 ||
    multasProblematicas.length > 0
  ) {
    nivel = 'CRITICO';
    titulo = 'ALERTA CRÍTICA: Antecedentes de alto riesgo en BCRA';
  } else if (
    peorSituacion === 2 ||
    tieneRefinanciacion ||
    tieneEnRevision ||
    chequesLevantados.length > 0 ||
    maxDiasAtraso > 0
  ) {
    nivel = 'PRECAUCION';
    titulo = 'PRECAUCIÓN: Registra observaciones o antecedentes históricos';
  } else if (entidadesActuales.length > 0) {
    nivel = 'LIMPIO';
    titulo = 'Situación Normal (Situación 1) y sin cheques rechazados';
  }

  return {
    cuit,
    cuitFormateado: formatearCuit(cuit),
    servicioDisponible,
    disponibilidad: {
      deudas: disponibleDeudas,
      historicas: disponibleHistoricas,
      chequesRechazados: disponibleRechazados
    },
    denominacion,
    periodoActual: ultimoPeriodoObj?.periodo || null,
    evaluacion: {
      nivel,
      titulo,
      alertas
    },
    resumen: {
      peorSituacion: peorSituacion || null,
      peorSituacionDesc: peorSituacion ? (SITUACIONES_DESC[peorSituacion] || `Situación ${peorSituacion}`) : 'Sin deudas informadas',
      totalDeudaPesos,
      cantidadEntidades: entidadesActuales.length,
      maxDiasAtraso,
      totalChequesRechazados: chequesRechazadosLista.length,
      chequesImpagos: chequesImpagos.length,
      chequesLevantados: chequesLevantados.length,
      montoRechazadoPesos,
      montoImpagoPesos,
      tieneSituacionJuridica,
      tieneProcesoJudicial,
      tieneMultaImpaga: multasProblematicas.length > 0
    },
    entidadesActuales,
    chequesRechazados: chequesRechazadosLista,
    historialPeriodos
  };
}

/**
 * Consulta si un cheque específico (codigoEntidad + numeroCheque) figura como denunciado en BCRA
 */
async function consultarChequeDenunciado({ codigoEntidad, banco, numeroCheque }) {
  const numClean = String(numeroCheque || '').replace(/\D/g, '');
  if (!numClean || !/^\d+$/.test(numClean)) {
    const err = new Error('El número de cheque debe contener solo dígitos numéricos.');
    err.statusCode = 400;
    throw err;
  }

  const codResuelto = await resolverCodigoEntidad(banco, codigoEntidad);
  if (!codResuelto) {
    const err = new Error('Debe seleccionar una entidad bancaria válida del BCRA.');
    err.statusCode = 400;
    throw err;
  }

  const resp = await fetchBcraJson(
    `${BCRA_BASE_URL}/cheques/v1.0/denunciados/${codResuelto}/${numClean}`
  );

  if (resp.networkError || (resp.status !== 200 && resp.status !== 404 && resp.status !== 400)) {
    return {
      servicioDisponible: false,
      codigoEntidad: codResuelto,
      numeroCheque: numClean,
      denunciado: null,
      detalles: [],
      mensaje: 'No se pudo consultar la API de Cheques Denunciados del BCRA en este momento.'
    };
  }

  if (resp.status === 404 || resp.status === 400) {
    const msgBcra = resp.data?.errorMessages?.[0] || 'No se encontraron datos para la entidad o cheque consultado.';
    return {
      servicioDisponible: true,
      codigoEntidad: codResuelto,
      numeroCheque: numClean,
      denunciado: false,
      detalles: [],
      mensaje: msgBcra,
      advertenciaBcra: resp.status === 404
    };
  }

  const r = resp.data?.results || {};
  return {
    servicioDisponible: true,
    codigoEntidad: codResuelto,
    numeroCheque: r.numeroCheque ?? numClean,
    denunciado: Boolean(r.denunciado),
    fechaProcesamiento: r.fechaProcesamiento || null,
    denominacionEntidad: r.denominacionEntidad || banco || '',
    detalles: Array.isArray(r.detalles) ? r.detalles : [],
    mensaje: r.denunciado
      ? '¡ATENCIÓN! Este cheque figura DENUNCIADO en el Banco Central.'
      : 'El cheque no registra denuncias en el Banco Central.'
  };
}

module.exports = {
  normalizarCuit,
  formatearCuit,
  obtenerEntidades,
  resolverCodigoEntidad,
  consultarCentralDeudores,
  consultarChequeDenunciado
};

