// Módulo de Notificaciones y Web Push para celular y navegador

const NotificationModule = {
  vapidPublicKey: null,

  init() {
    this.bindEvents();
    this.cargarNotificaciones();
    this.initServiceWorker();
  },

  bindEvents() {
    const btnBell = document.getElementById('btnNotificaciones');
    const dropdown = document.getElementById('dropdownNotificaciones');

    if (btnBell && dropdown) {
      btnBell.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target) && !btnBell.contains(e.target)) {
          dropdown.classList.remove('show');
        }
      });
    }

    const btnMarcarTodas = document.getElementById('btnMarcarTodasLeidas');
    if (btnMarcarTodas) {
      btnMarcarTodas.addEventListener('click', () => this.marcarTodasLeidas());
    }

    const btnActivarPush = document.getElementById('btnActivarPush');
    if (btnActivarPush) {
      btnActivarPush.addEventListener('click', () => this.solicitarPermisoPush());
    }

    const btnProbarPush = document.getElementById('btnProbarPush');
    if (btnProbarPush) {
      btnProbarPush.addEventListener('click', () => this.probarPush());
    }
  },

  async initServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        console.log('[SW] Service Worker registrado exitosamente:', reg.scope);

        // Obtener VAPID public key del backend
        const res = await API.get('/notificaciones/vapid-key');
        this.vapidPublicKey = res.publicKey;

        // Comprobar si ya está suscrito
        const sub = await reg.pushManager.getSubscription();
        const btnPush = document.getElementById('btnActivarPush');
        if (sub && btnPush) {
          btnPush.innerHTML = '<span>✅ Push Activo en este Celular</span>';
          btnPush.classList.replace('btn-secondary', 'btn-emerald');
        }
      } catch (err) {
        console.warn('[SW ERROR] No se pudo inicializar Service Worker:', err.message);
      }
    }
  },

  async solicitarPermisoPush() {
    if (!('Notification' in window)) {
      showToast('Tu navegador no soporta notificaciones push.', 'warning');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Permiso de notificaciones denegado en el navegador.', 'warning');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        if (!this.vapidPublicKey) {
          const resKey = await API.get('/notificaciones/vapid-key');
          this.vapidPublicKey = resKey.publicKey;
        }

        const convertedKey = this.urlB64ToUint8Array(this.vapidPublicKey);
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      // Enviar la suscripción al backend
      await API.post('/notificaciones/suscribir', sub);
      showToast('¡Notificaciones Push activadas para tu dispositivo!', 'success');

      const btnPush = document.getElementById('btnActivarPush');
      if (btnPush) {
        btnPush.innerHTML = '<span>✅ Push Activo en este Celular</span>';
        btnPush.classList.replace('btn-secondary', 'btn-emerald');
      }
    } catch (err) {
      showToast(`Error al suscribir push: ${err.message}`, 'error');
    }
  },

  async probarPush() {
    try {
      const res = await API.post('/notificaciones/probar', {});
      showToast(res.mensaje, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async cargarNotificaciones() {
    try {
      const res = await API.get('/notificaciones');
      const listEl = document.getElementById('notificacionesList');
      const badgeBell = document.getElementById('badgeNotificacionesCount');
      const dotBell = document.getElementById('badgeNotificacionesDot');

      const unreadCount = res.noLeidas || 0;

      if (badgeBell) {
        badgeBell.textContent = unreadCount;
        badgeBell.style.display = unreadCount > 0 ? 'inline-block' : 'none';
      }

      if (dotBell) {
        dotBell.style.display = unreadCount > 0 ? 'block' : 'none';
      }

      if (!listEl) return;

      if (!res.notificaciones || res.notificaciones.length === 0) {
        listEl.innerHTML = `
          <div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 0.85rem;">
            No tienes notificaciones pendientes.
          </div>
        `;
        return;
      }

      listEl.innerHTML = res.notificaciones.map(n => {
        const isUrgent = n.tipo === 'POR_VENCER_LEGAL';
        const isUnread = !n.leida;
        return `
          <div class="notification-item ${isUnread ? 'unread' : ''} ${isUrgent ? 'alert-danger' : 'alert-warning'}" onclick="NotificationModule.marcarLeida(${n.id})">
            <div class="notification-content">
              <h4>${n.titulo}</h4>
              <p>${n.mensaje}</p>
              <time>${new Date(n.created_at).toLocaleString('es-AR')}</time>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('Error cargando notificaciones:', e.message);
    }
  },

  async marcarLeida(id) {
    try {
      await API.patch(`/notificaciones/${id}/leida`);
      this.cargarNotificaciones();
    } catch (e) {
      // ignore
    }
  },

  async marcarTodasLeidas() {
    try {
      await API.post('/notificaciones/marcar-todas');
      showToast('Notificaciones marcadas como leídas', 'success');
      this.cargarNotificaciones();
    } catch (e) {
      showToast(e.message, 'error');
    }
  },

  urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};
