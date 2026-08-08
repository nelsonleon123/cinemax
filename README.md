# CINEMAX - Sistema de Gestión de Cine

Este proyecto es un sistema de gestión web completo para un cine, diseñado como un proyecto académico para el SENA (Tecnología en Análisis y Desarrollo de Software). Implementa un flujo completo de venta de boletos, selección de asientos, dulcería con compras multi-producto, cancelaciones, gestión de películas, funciones, promociones, empleados y reportes estadísticos.

---

## ⚠️ Antes de correr el proyecto
1. Abre `.env` y coloca tu **contraseña real de PostgreSQL** en `DB_PASSWORD` (quedó con un valor de ejemplo por seguridad).
2. Nunca compartas o subas tu archivo `.env` real a ningún lado (ya se agregó `.gitignore` para evitarlo). Usa `.env.example` como plantilla sin datos reales.

## Correcciones aplicadas a la primera versión generada
- 🔴 **Crítico**: el trigger `fn_trg_boletos_validar_insert` sobreescribía `asiento_id` del boleto con el ID del tipo de asiento en vez de validar contra una variable propia — cada boleto quedaba asociado al asiento incorrecto. Corregido.
- 🟠 Varios endpoints (`candy.js`, `promos.js`, `shows.js`, `tickets.js`) respondían con el código HTTP inválido `21` en operaciones exitosas, lo que el frontend interpretaba como error. Corregido a `201`.
- 🟡 No había validación de funciones duplicadas (misma sala/fecha/hora). Se agregó una restricción única en la base de datos (`uq_funcion_sala_fecha_hora`) y su manejo amigable en el backend.
- 🟡 `fetchAPI` fallaba si el backend respondía sin cuerpo o con contenido no-JSON. Ahora lo maneja sin romper la app.
- 🟡 La sesión guardada en `localStorage` podía romper la carga de la app si quedaba corrupta. Ahora se limpia automáticamente.
- 🟡 Faltaba la interfaz para que el administrador gestionara (crear/editar/eliminar) productos de dulcería — el backend ya lo soportaba pero no había botón ni formulario. Se agregó.

---

## Stack Técnico Utilizado
* **Base de Datos:** PostgreSQL con uso intensivo de Triggers, Funciones y Procedimientos Almacenados.
* **Backend:** Node.js + Express + conexión con `pg` y autenticación vía JWT.
* **Frontend:** HTML5, CSS3 Vanilla (estilo oscuro responsivo inspirado en Netflix) y Javascript Vanilla (comunicación mediante `fetch`).
* **Seguridad:** Contraseñas hasheadas en base de datos usando `pgcrypto` (bcrypt).

---

## Estructura del Proyecto
```text
cinemax/
├── package.json          # Dependencias y scripts de ejecución
├── .env                  # Configuración de variables de entorno
├── README.md             # Instrucciones de instalación y uso

├── database/
│   └── schema.sql        # Script único autocontenido de base de datos
├── backend/
│   ├── server.js         # Entrada principal del servidor Express
│   ├── config/
│   │   └── db.js         # Pool de conexiones a PostgreSQL
│   ├── middleware/
│   │   └── auth.js       # Verificación de JWT y control de roles
│   └── routes/           # Endpoints del backend organizados por recurso
└── frontend/             # Archivos estáticos de la interfaz web
    ├── index.html        # Página principal (SPA)
    ├── css/
    │   └── styles.css    # Hojas de estilo personalizadas (Dark Theme)
    └── js/               # Módulos Javascript
```

---

## Instrucciones de Instalación y Configuración

### 1. Configuración de la Base de Datos en pgAdmin
1. Abre **pgAdmin** y conéctate a tu servidor local de PostgreSQL.
2. Crea una nueva base de datos llamada `cinemax`.
3. Haz clic derecho sobre la base de datos `cinemax` y abre la **Query Tool** (Herramienta de Consultas).
4. Abre el archivo [schema.sql](file:///C:/Users/leonr/.gemini/antigravity/scratch/cinemax/database/schema.sql) que está en la carpeta `database/`, copia todo su contenido y pégalo en la Query Tool.
5. Ejecuta el script. Este script creará todas las tablas, vistas de reportes, funciones, triggers y cargará los datos iniciales.

*Nota:* El procedimiento para generar los asientos de las salas (`CALL sp_generar_asientos_cine();`) **se ejecuta automáticamente** al final de `schema.sql`. Si por algún motivo deseas vaciar y volver a generar los asientos por defecto, puedes ejecutar en pgAdmin:
```sql
CALL sp_generar_asientos_cine();
```

---

### 2. Configurar el Archivo de Entorno `.env`
Crea o edita el archivo [.env](file:///C:/Users/leonr/.gemini/antigravity/scratch/cinemax/.env) en la raíz del proyecto y ajusta las credenciales de PostgreSQL si son distintas de las indicadas por defecto:

```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_DATABASE=cinemax
DB_PASSWORD=TU_CONTRASENA_AQUI
DB_PORT=5432
JWT_SECRET=cinemax_secret_key_sena_2026
```

---

### 3. Instalar Dependencias del Backend
Abre tu consola de comandos en el directorio del proyecto y ejecuta:

```bash
npm install
```

---

### 4. Iniciar el Servidor de Desarrollo
Para levantar el servidor Express en modo desarrollo (se reinicia automáticamente ante cualquier cambio gracias al watch de Node.js):

```bash
npm run dev
```

El servidor estará escuchando en [http://localhost:3000](http://localhost:3000). Abre este enlace en tu navegador web.

---

## Credenciales de Prueba (Semilla)
Puedes iniciar sesión en la interfaz web con los siguientes usuarios cargados por defecto:

1. **Rol Administrador (Acceso total + Reportes + CRUDs):**
   * **Usuario:** `admin`
   * **Contraseña:** `admin123`

2. **Rol Taquillero (Solo Boletería, Dulcería y Cancelaciones):**
   * **Usuario:** `taquillero`
   * **Contraseña:** `taquillero123`

---

## Reglas de Negocio Clave Implementadas
1. **Asientos Únicos:** La base de datos contiene un índice único parcial `idx_boleto_vendido_asiento_funcion` sobre `boletos` que restringe el duplicado de asientos por función solo si `estado = 'vendido'`. Si el boleto pasa a estado `'cancelado'`, el asiento queda disponible inmediatamente para volverse a vender.
2. **Cálculo de Precios Unificado:** El trigger `BEFORE INSERT ON boletos` realiza la búsqueda automática del precio base según el tipo de asiento (`básica`, `VIP`, `palomera`) y aplica la promoción activa de manera automática, calculando los valores `precio_original` y `precio_pagado`.
3. **Autenticación en la BD:** El login se efectúa a través de la función `fn_verificar_login` que utiliza `pgcrypto` para validar la contraseña hasheada.
4. **Dulcería Multi-producto:** La función `fn_vender_dulceria` procesa en una sola transacción un lote JSON de productos seleccionados, y un trigger actualiza dinámicamente el total de la factura.
5. **Reportes:** Se implementaron vistas SQL (`vw_ventas_por_pelicula`, `vw_ventas_por_sala`, etc.) que totalizan las ventas de boletos con `estado = 'vendido'`, excluyendo por completo boletos cancelados.
