# Tasks

Origen: `SRC=../CHILI/chili-agentes-ia-back` (solo lectura). Copiar siempre con `rsync -a --exclude node_modules --exclude dist --exclude .env --exclude .git --exclude .DS_Store`, sin leer el contenido.

## 1. Copia en bruto

- [x] 1.1 Copiar la configuración raíz (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`, `.prettierrc`, `.gitignore`, `.dockerignore`, `Dockerfile`, `docker-compose.yml`). Verificar con `ls` que están todos y que no existe `.env`
- [x] 1.2 Copiar `src/files/`, `src/whatsapp/`, `src/common/` y `src/main.ts`, `src/app.module.ts`. Verificar con `find src -type f` que la lista coincide
- [x] 1.3 Copiar de `src/conversation/`: `inbound/`, `outbound/`, `runner/`, `batcher/`, `agents/shared/`, `entities/{adk-session,adk-event,conversation-message}.entity.ts`, `session/{typeorm-session.service,user-lock,session-state}.ts` con sus `.spec.ts`, más `agents/router/router.agent.ts` y `router.prompt.ts` como base del agente de ejemplo. Verificar con `find src/conversation -type f`
- [x] 1.4 Borrar los specs copiados que prueban dominio (`runner/billing-flow.integration.spec.ts` y cualquier otro que importe billing, case o ticket, según `grep -l`). Verificar que `grep -rlE "billing|ticket|case/" src --include=*.spec.ts` no devuelve nada

## 2. Cortar amarres de dominio

- [x] 2.1 En `whatsapp.controller.ts` quitar el import y los usos de `@Public()`. Verificar que `grep -rn "auth/" src` no devuelve nada
- [x] 2.2 En `typeorm-session.service.ts` quitar `HumanAttentionNotifier` y `CHAT_BOT_EVENT`/`BotStatusEvent` (imports, inyección y llamadas). Verificar que `grep -rnE "case/|chat/" src` no devuelve nada y que su `.spec.ts` sigue pasando con `pnpm jest src/conversation/session`
- [x] 2.3 Crear `agents/assistant/` a partir de router (`assistant.agent.ts`, `assistant.prompt.ts`) con prompt genérico de Minimundo y una sola tool trivial (`get_current_time`). Borrar `agents/router/`. Renombrar `ROUTER_APP_NAME` a `APP_NAME` con `sed`. Verificar que `grep -rn "Router\|ROUTER_" src` no devuelve nada
- [x] 2.4 Agregar un test unitario del agente de ejemplo: la tool regresa datos y el agente se construye con su prompt y tool. Verificar con `pnpm jest src/conversation/agents/assistant`

## 3. Reescritura mínima

- [x] 3.1 Escribir `replies.ts` mínimo (`ERROR_REPLY`, `UNSUPPORTED_REPLY`) con textos neutrales de Minimundo. Verificar que solo exporta lo que se importa (`grep`)
- [x] 3.2 Leer las firmas públicas de `AgentRunner`, `OutboundDispatcher`, `InboundService`, el batcher y `FilesService`, y escribir `conversation.service.ts` mínimo con el flujo webhook → parse → adjuntos → batcher → `withUserLock` → runner → dispatcher, que envía `ERROR_REPLY` cuando falla. Agregar `conversation.service.spec.ts` con mocks que cubran: un turno de texto envía la salida, un estado sin mensajes no corre el agente, y un fallo del runner envía `ERROR_REPLY` y libera el lock. Verificar con `pnpm jest src/conversation/conversation.service`
- [x] 3.3 Escribir `conversation.module.ts` mínimo (entidades de sesión, eventos y mensajes, `FilesModule`, providers copiados) y ajustar `whatsapp.module.ts` sin `forwardRef` innecesarios. Verificar con `pnpm tsc --noEmit`
- [x] 3.4 Reescribir `app.module.ts` (ConfigModule global, TypeORM `forRoot` con `DB_*`, `FilesModule`, `WhatsappModule`, `ConversationModule`) y `main.ts` con `rawBody: true`, sin guards de auth. Verificar con `pnpm tsc --noEmit`

## 4. Firma del webhook de Meta

- [x] 4.1 Validar `X-Hub-Signature-256` en `POST /whatsapp/webhook` con HMAC-SHA256 de `rawBody` usando `WHATSAPP_APP_SECRET` y `timingSafeEqual`, y responder 401 si falta o no coincide. Agregar un test que cubra firma válida, ausente e inválida. Verificar con `pnpm jest src/whatsapp`
- [x] 4.2 Agregar un test del `GET /whatsapp/webhook`: token correcto devuelve el challenge y token incorrecto devuelve 403. Verificar con `pnpm jest src/whatsapp`

## 5. Dependencias y configuración

- [x] 5.1 Podar `package.json`: por cada dependencia, `grep -r "from '<pkg>" src` y quitar las que no se usan (pdf, ocr, qr, jwt, passport, socket.io, etc.), cambiar `name` a `minimundo-bot` y correr `pnpm install`. Verificar con `pnpm build` sin errores
- [x] 5.2 Crear `.env.example` solo con nombres: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DROP_SCHEMA`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_REGION`, `AWS_S3_NAME`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `BATCH_QUIET_MS`. Verificar con `grep -rhoE "process.env\.[A-Z0-9_]+" src` que no falta ninguna variable usada
- [x] 5.3 Ajustar `docker-compose.yml` para que solo levante Postgres y la app con nombres de Minimundo. Verificar con `docker compose config`
- [x] 5.4 Escribir un `README.md` corto: setup, variables, cómo configurar el webhook en Meta y cómo crear un agente nuevo copiando `agents/assistant/`. Verificar que los comandos del README corren tal como están escritos

## 6. Auth, usuarios y roles

- [x] 6.1 Copiar `src/auth`, `src/users`, `src/rols` de CHILI y reinstalar `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/mapped-types`, `passport`, `passport-jwt`, `bcrypt`. Verificar que `pnpm tsc --noEmit` pasa
- [x] 6.2 Quitar `Branch` de users (entity, service, DTOs, module), restaurar `File.users` como inverso de `User.avatar` y dejar solo los roles Administrador y View All. Verificar que `grep -rni branch src/users` no devuelve nada
- [x] 6.3 Hacer obligatorio `JWT_SECRET` y que el admin inicial salga de `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; agregarlas a `.env.example`. Verificar que no queda ninguna credencial en código
- [x] 6.4 Registrar `JwtAuthGuard` como `APP_GUARD` y marcar `@Public()` el webhook y `current-version`. Verificar con curl: `/user/paginate` y `/files/:id` responden 401 sin token, el login devuelve token sin `password`, `PATCH /user/:id` con apellido nulo responde 200 y el webhook sigue respondiendo sin JWT

## 7. Verificación integral

§§§, `pnpm test` y `pnpm build` pasan
- [x] 7.2 Levantar Postgres con `docker compose`, correr `pnpm start:dev` con un `.env` local y verificar que arranca y crea las tablas
- [x] 7.3 Enviar con `curl` un `POST /whatsapp/webhook` firmado con un payload de texto de ejemplo y verificar en los logs que se ejecutó el turno del agente y se intentó el envío (sin credenciales reales de WhatsApp, el envío puede fallar)
