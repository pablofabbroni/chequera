# 🏦 CheckPro - Sistema de Control y Gestión de Cheques

Sistema web profesional, moderno y de alto rendimiento para el control, descuento y administración de cheques en cartera y cheques entregados a terceros. Incluye cálculos automáticos de tasas de interés, ganancias netas, alertas tempranas de cobro y avisos críticos de vencimiento legal (plazo de 30 días posteriores al cobro con notificación push al celular).

---

## 🚀 Características Principales

1. **🔐 Autenticación y Seguridad**:
   - Inicio de sesión seguro con contraseñas encriptadas (`bcryptjs`) y tokens `JWT`.
   - Credenciales de demostración iniciales:
     - **Email:** `admin@cheques.com`
     - **Contraseña:** `admin123`

2. **📝 Módulo "Ingresar Cheque" (Cálculo Financiero en Vivo)**:
   - Registro de: N° de Cheque, Banco (selector con bancos de Argentina o personalizado), Emisor, Entregador (cliente que descuenta), Fecha de recepción, Fecha de cobro, Importe ($), Tasa de interés (%) ingresada manualmente por el usuario.
   - **Cálculo Automático Instantáneo**:
     $$\text{Interés Cobrado (Ganancia)} = \text{Importe} \times \left(\frac{\text{Tasa}}{100}\right)$$
     $$\text{Dinero Saliente a Entregar} = \text{Importe} - \text{Interés Cobrado}$$
   - Cálculo en vivo del plazo en días entre recepción y cobro.

3. **💼 Módulo "Cartera" (Stock de Cheques Activos)**:
   - Stock centralizado con estados: `Pendiente` (por defecto al ingresar), `Cobrado` o `Rechazado`.
   - Transiciones manuales con modales de confirmación e ingreso de motivo de rechazo.
   - **Sistema de Alertas Inteligentes**:
     - **Cobro Cercano**: Aviso cuando la fecha de cobro es hoy o dentro de los próximos 3 días.
     - **Alerta Crítica de Vencimiento Legal**: Un cheque vence legalmente a los 30 días posteriores a la fecha de cobro. Si continúa pendiente y faltan 5 días o menos para cumplir ese mes (del día 25 al día 30), el sistema resalta una **etiqueta roja pulsante** y emite notificaciones.
   - Filtros por estado, buscador en tiempo real, filtro "Solo Alertas" y exportación completa a **Excel (.xlsx)**.

4. **📤 Módulo "Entregados" (Salidas de Cartera)**:
   - Permite dar salida a cheques de cartera para pagar insumos, proveedores o gastos del negocio.
   - Selector inteligente de cheques disponibles en estado `Pendiente`.
   - Registro de destinatario, fecha de entrega y concepto del pago.
   - Posibilidad de **Revertir la Entrega** con 1 clic si una operación se cancela (el cheque retorna a la cartera como Pendiente).

5. **📊 Dashboard Financiero y Métricas de Negocio**:
   - Ganancias netas obtenidas por cobro de tasas de interés.
   - Tasa promedio ponderada aplicada.
   - Cantidad e importes totales clasificados por: Cartera (Pendientes), Cobrados, Entregados y Rechazados.
   - Gráfico de **Evolución Mensual** (Volumen operado vs Utilidad en intereses).
   - Gráfico de **Flujo de Cobros Proyectado (Cash Flow)**.
   - Distribución porcentual por Bancos.
   - Ranking de **Top Clientes** (quién descuenta más cheques y genera mayor ganancia).
   - Filtros dinámicos por Año y Mes.

6. **📱 PWA & Notificaciones Push para el Celular**:
   - Compatible como aplicación móvil (PWA - "Añadir a pantalla de inicio").
   - Integración nativa con **Web Push API** (`web-push` y Service Worker con claves VAPID).
   - Botón directo para activar notificaciones push en el teléfono y botón para enviar prueba instantánea.

---

## 🐳 Despliegue en VPS con Docker (Recomendado)

El sistema viene 100% preparado con `Dockerfile` y `docker-compose.yml` para desplegarse en cualquier servidor VPS (Ubuntu, Debian, etc.) en **1 solo comando**.

### Paso 1: Clonar o subir los archivos al VPS
```bash
git clone <tu-repositorio> /opt/check-in
cd /opt/check-in
```

### Paso 2: Configurar las variables de entorno (opcional)
Si deseas cambiar las contraseñas predeterminadas, copia el archivo de ejemplo:
```bash
cp .env.example .env
nano .env
```

### Paso 3: Levantar los contenedores
```bash
docker compose up -d --build
```

¡Listo! La aplicación y la base de datos MySQL 8.0 se iniciarán automáticamente:
- **Web:** `http://TU_IP_VPS:3000`
- **Base de datos MySQL:** Puerto 3306 (persistencia de datos en volumen `mysql_data`).

Para detener o reiniciar:
```bash
# Ver logs en tiempo real
docker compose logs -f

# Detener los contenedores
docker compose down

# Reiniciar
docker compose restart
```

---

## 💻 Ejecución Local sin Docker (Desarrollo)

Si tienes Node.js y MySQL instalados en tu máquina:

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar la base de datos**:
   Asegúrate de que en `.env` los datos de conexión apunten a tu MySQL local:
   ```ini
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=tu_password
   DB_NAME=cheques_db
   ```
   *Nota: El sistema crea automáticamente la base de datos `cheques_db` y todas las tablas si no existen al iniciar.*

3. **Iniciar el servidor**:
   ```bash
   npm start
   # O en modo desarrollo con recarga automática:
   npm run dev
   ```
   Abrir en el navegador: [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del Proyecto

```
check-in/
├── src/
│   ├── config/
│   │   └── db.js                 # Conexión MySQL, pool y auto-creación de tablas
│   ├── controllers/
│   │   ├── authController.js     # Login, sesión y JWT
│   │   ├── chequeController.js   # Ingreso, fórmulas, cartera y exportación Excel
│   │   ├── entregaController.js  # Endoso y entrega a terceros
│   │   ├── dashboardController.js# Métricas financieras y cashflow
│   │   └── notificationController.js # Alertas y Web Push
│   ├── middlewares/
│   │   └── authMiddleware.js     # Protección de rutas con JWT
│   ├── routes/                   # Endpoints RESTful
│   ├── services/
│   │   ├── alertService.js       # Verificación de cobros y vencimiento legal (30 días)
│   │   └── pushService.js        # Envío de notificaciones Push (VAPID)
│   └── server.js                 # Servidor Express y scheduler de alertas
├── public/
│   ├── index.html                # Interfaz SPA responsiva (Escritorio + Móvil)
│   ├── manifest.json             # Manifiesto PWA para celular
│   ├── sw.js                     # Service Worker para Push Notifications
│   ├── css/
│   │   └── app.css               # Sistema de diseño moderno, dark mode y glassmorphism
│   ├── js/
│   │   ├── api.js                # Cliente HTTP y formateadores de moneda
│   │   ├── app.js                # Enrutador de pestañas y sesión
│   │   ├── dashboard.js          # Gráficos Chart.js y KPIs
│   │   ├── ingreso.js            # Fórmulas reactivas al escribir números
│   │   ├── cartera.js            # Stock, filtros y cambios de estado
│   │   ├── entregados.js         # Salidas de cheques y reversiones
│   │   └── notifications.js      # Campana de alertas y suscripción Web Push
│   └── icons/                    # Iconos vectoriales PWA
├── Dockerfile                    # Contenedor optimizado Node.js Alpine
├── docker-compose.yml            # Orquestación con MySQL 8.0 persistente
├── .env.example                  # Plantilla de variables de entorno
└── package.json
```

---

## 📋 Reglas de Negocio Implementadas

- **Cálculo de Descuento**:
  El usuario ingresa la tasa porcentual deseada para cada cheque. El sistema calcula en vivo:
  - $\text{Interés cobrado} = \text{Importe} \times (\text{Tasa} / 100)$
  - $\text{Dinero saliente} = \text{Importe} - \text{Interés cobrado}$
- **Vencimiento Legal (Cheques de Pago Diferido / Comunes)**:
  - Plazo legal de cobro: 30 días posteriores a la fecha de cobro registrada.
  - Alerta prioritaria: Se activa automáticamente cuando restan **5 días o menos** para que se cumpla el mes posterior a la fecha de cobro si el cheque sigue en estado `Pendiente`.
- **Notificaciones Push**:
  - Al presionar *"Activar Push en Celular"*, el dispositivo queda registrado y recibe alertas en segundo plano sobre los cheques próximos a vencer o listos para cobrar.
