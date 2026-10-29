// Aplicación Principal - Enrutador SPA, Estado de Sesión y Controladores

const App = {
  usuarioActual: null,

  async init() {
    this.bindGlobalEvents();
    await this.verificarSesion();
  },

  bindGlobalEvents() {
    // Escuchar cambios de hash para navegación fluida
    window.addEventListener('hashchange', () => this.navegarRuta());

    // Evento de desautorización (token expirado)
    window.addEventListener('auth:unauthorized', () => {
      this.mostrarLogin();
    });

    // Formulario de Login
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', (e) => this.handleLogin(e));
    }

    // Botón de Logout
    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => this.handleLogout());
    }

    // Toggle Sidebar Móvil
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    const sidebar = document.getElementById('mainSidebar');
    if (btnToggleSidebar && sidebar) {
      btnToggleSidebar.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // Cerrar al hacer clic fuera en móviles
      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !btnToggleSidebar.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }

    // Cerrar sidebar al hacer clic en un link en móviles
    const navLinks = document.querySelectorAll('.nav-item, .mobile-nav-item');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('open');
      });
    });
  },

  async verificarSesion() {
    const token = API.getToken();
    if (!token) {
      this.mostrarLogin();
      return;
    }

    try {
      const res = await API.get('/auth/me');
      this.usuarioActual = res.usuario;
      this.actualizarUIUsuario();
      this.mostrarApp();
      this.navegarRuta();
      NotificationModule.init();
    } catch (err) {
      this.mostrarLogin();
    }
  },

  mostrarLogin() {
    const loginView = document.getElementById('viewLogin');
    const appView = document.getElementById('viewApp');
    if (loginView && appView) {
      loginView.style.display = 'flex';
      appView.style.display = 'none';
    }
  },

  mostrarApp() {
    const loginView = document.getElementById('viewLogin');
    const appView = document.getElementById('viewApp');
    if (loginView && appView) {
      loginView.style.display = 'none';
      appView.style.display = 'flex';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btnSubmit = document.getElementById('btnLoginSubmit');

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span>Verificando...</span>';
    }

    try {
      const res = await API.post('/auth/login', { email, password });
      API.setToken(res.token);
      this.usuarioActual = res.usuario;
      this.actualizarUIUsuario();
      this.mostrarApp();

      if (!window.location.hash) {
        window.location.hash = '#dashboard';
      } else {
        this.navegarRuta();
      }

      showToast(`¡Bienvenido, ${res.usuario.nombre}!`, 'success');
      NotificationModule.init();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<span>Iniciar Sesión</span>';
      }
    }
  },

  async handleLogout() {
    try {
      await API.post('/auth/logout', {});
    } catch (e) {
      // ignore
    }
    API.setToken(null);
    this.usuarioActual = null;
    this.mostrarLogin();
    showToast('Sesión cerrada.', 'success');
  },

  actualizarUIUsuario() {
    if (!this.usuarioActual) return;
    const nameEl = document.getElementById('lblUsuarioNombre');
    const avatarEl = document.getElementById('lblUsuarioAvatar');
    if (nameEl) nameEl.textContent = this.usuarioActual.nombre;
    if (avatarEl) avatarEl.textContent = this.usuarioActual.nombre.charAt(0).toUpperCase();
  },

  navegarRuta() {
    const hash = window.location.hash || '#dashboard';
    const cleanHash = hash.replace('#', '');

    // Ocultar todas las páginas
    const pages = document.querySelectorAll('.page-view');
    pages.forEach(p => p.style.display = 'none');

    // Activar navegación activa
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('href') === hash);
    });

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('href') === hash);
    });

    // Título de la navbar
    const pageTitle = document.getElementById('navbarPageTitle');
    const pageSubtitle = document.getElementById('navbarPageSubtitle');

    switch (cleanHash) {
      case 'dashboard':
        document.getElementById('pageDashboard').style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Panel Principal';
        if (pageSubtitle) pageSubtitle.textContent = 'Métricas, análisis de ganancias y proyección de cobros';
        DashboardModule.init();
        break;

      case 'ingreso':
        document.getElementById('pageIngreso').style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Ingresar Cheque';
        if (pageSubtitle) pageSubtitle.textContent = 'Carga de cheques con cálculo automático de tasas y dinero saliente';
        IngresoModule.init();
        break;

      case 'cartera':
        document.getElementById('pageCartera').style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Cartera de Cheques';
        if (pageSubtitle) pageSubtitle.textContent = 'Stock disponible, gestión de estados y control de vencimientos';
        CarteraModule.init();
        break;

      case 'entregados':
        document.getElementById('pageEntregados').style.display = 'block';
        if (pageTitle) pageTitle.textContent = 'Cheques Entregados';
        if (pageSubtitle) pageSubtitle.textContent = 'Pagos a proveedores y salida de cheques endosados';
        EntregadosModule.init();
        break;

      default:
        window.location.hash = '#dashboard';
        break;
    }

    // Scroll arriba suave
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// Iniciar app al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
