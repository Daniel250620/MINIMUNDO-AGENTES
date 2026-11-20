# Minimundo bot

Backend NestJS para agentes de IA en WhatsApp (Google ADK + Gemini, Postgres con TypeORM y S3). La base viene de CHILI y usa el mismo contrato de mensajes de WhatsApp.

## Setup

```bash
pnpm install
cp .env.example .env   # llena los valores
docker compose up -d db
pnpm start:dev
```

Las tablas se crean solas al arrancar (`synchronize`). Todas las rutas llevan el prefijo `/api`.

## Auth (para el front)

Todas las rutas piden `Authorization: Bearer <token>` salvo el webhook, `current-version` y el login.

- `POST /api/auth/login` con `{ email, password }` devuelve `token`, el usuario y los permisos de su rol.
- `GET /api/auth/validate` devuelve el usuario del token.
- `/api/user` y `/api/rol` administran usuarios y roles.
- `JWT_SECRET` es obligatoria. El admin inicial se crea con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`.
- Para que una ruta nueva sea pública, márcala con `@Public()`.

## Configurar el webhook en Meta

1. En la app de Meta (WhatsApp > Configuración), la URL del webhook es `https://<tu-host>/api/whatsapp/webhook`.
2. El token de verificación es el valor de `WHATSAPP_VERIFY_TOKEN`.
3. Suscribe el campo `messages`.
4. Copia el **App secret** (Configuración de la app > Básica) en `WHATSAPP_APP_SECRET`. Sin él, todos los `POST` del webhook responden 401.

Para desarrollo local, expón el puerto con un túnel (por ejemplo `ngrok http 3000`).

## Flujo de un mensaje

```
POST /api/whatsapp/webhook  (firma X-Hub-Signature-256)
  -> parse-webhook       contrato IncomingMessage
  -> batcher             agrupa la ráfaga (BATCH_QUIET_MS)
  -> withUserLock        un turno a la vez por usuario
  -> AgentRunner         ADK + sesión en Postgres
  -> OutboundDispatcher  contrato OutboundMessage -> WhatsApp
```

Escribir "adiós" borra la sesión del usuario.

## Crear un agente nuevo

1. Copia `src/conversation/agents/assistant/` a una carpeta nueva y cambia el nombre de la clase, el `name`, el prompt y las tools.
2. Las tools que regresan datos dejan que el modelo redacte. Para enviar un mensaje fijo (botones, lista), la tool regresa un `OutboundMessage` y marca `ctx.actions.skipSummarization = true`.
3. Para usarlo como sub-agente, agrégalo en las tools del agente raíz con `new DirectAgentTool({ agent })` (en `agents/shared/`) y regístralo como provider en `conversation.module.ts`.
4. Para que sea el agente raíz, inyéctalo en `AgentRunner` en lugar de `AssistantAgent`.

## Pendientes conocidos

- Los tokens JWT duran 365 días (heredado de CHILI).
- El batcher y el lock son en memoria, así que solo sirven para una instancia.
- Los adjuntos del turno viven en memoria (`InMemoryArtifactService`).

## Scripts

```bash
pnpm test
```

```bash
pnpm lint
```

```bash
pnpm build
```
