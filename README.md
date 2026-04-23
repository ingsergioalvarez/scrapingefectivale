# Control Vehicular (Efectivale + Telegram)

Monorepo con:

- `server/`: API Node.js (Express) + Playwright + MySQL (Telegram / cortes de saldo)
- `web/`: Frontend React (Vite) para accesos Efectivale, scraping y administración de solicitudes de gasolina

## 1) Variables de entorno

Copia `.env.example` a `.env` y completa al menos:

- **`MYSQL_*`**: base de datos para cortes de saldo (5:00 y 17:00), solicitudes de gasolina vía Telegram y aclaraciones.
- **`TELEGRAM_BOT_TOKEN`**: token que te da **@BotFather** en Telegram (`/newbot`).
- **`ADMIN_API_KEY`**: clave para la pantalla **Admin gasolina** y la API `/api/admin/*`.
- **`ENCRYPTION_KEY_BASE64`**: 32 bytes en base64 (opcional si usas el fallback en `server/data/encryption-key.base64`).

Generar clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 2) Almacenamiento de cuentas (Excel)

Las cuentas Efectivale y sesiones Playwright van en:

- `server/data/store.xlsx`

## 3) Instalar dependencias

```bash
npm install
```

## 4) Levantar API y Web

```bash
npm run dev:all
```

O por separado: `npm run dev -w server` y `npm run dev -w web`.

## 5) MySQL (Telegram)

Al arrancar el servidor, si `MYSQL_HOST` y `MYSQL_DATABASE` están definidos, se crean/verifican las tablas necesarias.

SQL de referencia: `server/sql/telegram_mysql.sql`.

## 6) Reporte Excel Efectivale (13:00)

Rutina diaria que genera Excel y, si hay SMTP, envía correo. Endpoint manual:

`POST /api/reports/efectivale/run-now`

## 7) Telegram

Con `TELEGRAM_BOT_TOKEN` configurado, el bot arranca con la API. **El usuario debe escribir `hola`** para activar el asistente; antes de eso no se procesan saldo, gasolina ni aclaraciones (`/start` solo indica que debes escribir hola).

`ADMIN_API_KEY` protege la web donde se autorizan las cargas de gasolina (no hay API de Efectivale; se usa scraping con Playwright).

No subas el token a repositorios públicos; revócalo en BotFather si se filtró.
