# Design

## Context

El repo solo tiene `openspec/` y `.claude/`. El origen es `../CHILI/chili-agentes-ia-back` (pnpm, NestJS, TypeORM/Postgres, `@google/adk` 2.x, `@google/genai`, AWS SDK v3). Ese código es de solo lectura para este cambio.

Mapa de dependencias observado en CHILI (solo lo que cruza la frontera de lo que se copia):

```
whatsapp.controller ------> auth/decorators/public          (se copia auth)
users ---------------------> branch (sucursales)             (se quita)
whatsapp.controller ------> conversation.service            (se reescribe)
typeorm-session.service --> case/human-attention-notifier   (se quita)
typeorm-session.service --> chat/chat.events                (se quita)
agent-runner -------------> agents/router/router.agent      (se cambia por assistant)
conversation-message -----> files/entities/file.entity      (se copia, ok)
files.controller ---------> common/pipes/uuid.pipe          (se copia, ok)
conversation.module/service, replies.ts -> billing, case, ticket, feedback... (se reescriben)
```

## Goals / Non-Goals

**Goals:**
- Gastar el mínimo de tokens: copiar archivos con `rsync` sin leerlos y editar solo los puntos de amarre.
- Conservar el contrato de mensajes de CHILI bit a bit (`incoming-message.ts`, `outbound-message.ts`, `whatsapp-payload.ts`, `validate-outbound.ts` sin cambios), para que los agentes y prompts sean portables entre proyectos.
- Que `pnpm build` compile y la app arranque con Postgres y las variables de `.env.example`.

**Non-Goals:**
- Sincronizar cambios futuros entre CHILI y Minimundo (es un fork, no una librería compartida).
- Despliegue, CI/CD y migraciones versionadas.

## Decisions

**Copiar con `rsync` y podar, en vez de reescribir.** Los archivos se copian completos con exclusiones (`node_modules`, `dist`, `.env`, `.git`, `*.DS_Store`). Los `*.spec.ts` de los módulos copiados también se copian: son la verificación de que el contrato sigue igual. Alternativa: leer y reescribir cada archivo, que cuesta muchos tokens y meteria diferencias accidentales en el contrato.

**Reescribir y no podar `conversation.module.ts`, `conversation.service.ts`, `replies.ts`, `app.module.ts` y `main.ts`.** Casi todo su contenido es de dominio (el service tiene 504 líneas). Una versión mínima de alrededor de 80 líneas cuesta menos que quitarle cosas a la grande. El service nuevo hace solo esto: `handleWebhook` → `parse-webhook` → guardar adjuntos con `FilesService` → batcher → `withUserLock` → `AgentRunner` → `OutboundDispatcher`, y en caso de error envía `ERROR_REPLY`. Antes de escribirlo se leen las firmas públicas (no la implementación completa) de `AgentRunner`, `OutboundDispatcher`, `InboundService` y del batcher.

**Quitar los amarres de `typeorm-session.service.ts` con ediciones puntuales.** Se borran los imports y usos de `HumanAttentionNotifier` y `CHAT_BOT_EVENT`. Si el evento al panel se usa para el estado "bot encendido/apagado", ese campo se queda en la sesión, pero sin emitir el evento. Alternativa: dejar un notifier no-op inyectable, que sería código para un futuro que nadie pidió.

**Agente de ejemplo con la forma del router.** Se copia `agents/router/router.agent.ts` y `router.prompt.ts` como `agents/assistant/`, se le quitan las tools de dominio y se deja una tool trivial (por ejemplo, `get_current_time`), que regresa datos y no texto final. Se renombra `ROUTER_APP_NAME` a `APP_NAME` en un solo lugar (`adk-session.entity.ts`) con `sed` en los archivos que lo importan.

**Firma de Meta con el cuerpo crudo.** `main.ts` crea la app con `rawBody: true` y el `POST /whatsapp/webhook` compara `X-Hub-Signature-256` contra `HMAC-SHA256(WHATSAPP_APP_SECRET, rawBody)` con `crypto.timingSafeEqual`. Es una función pequeña dentro del controller o un guard de unas 20 líneas, sin dependencias nuevas. En CHILI esto no existía.

**Auth de CHILI con guard global.** `JwtAuthGuard` va como `APP_GUARD`: todo requiere JWT salvo `@Public()` (webhook GET/POST, `current-version`, login). El webhook sigue protegido por la firma de Meta. Cambios respecto a CHILI: `JWT_SECRET` es obligatorio (CHILI usaba `'secret'` de respaldo, que permite falsificar tokens), el admin inicial sale de `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` en vez de correos y contraseña en código, se quitan los roles `Sucursal` y `Chili Agente`, y `users.update` normaliza con el método null-safe de la entidad (el de CHILI truena si un apellido es `null`).

**Esquema de base de datos con `synchronize` en desarrollo.** Se mantiene lo que haga `app.module.ts` de CHILI (TypeORM `forRoot` con `DB_*` y `DROP_SCHEMA`) y solo se dejan las entidades copiadas: `File`, `SessionEntity`, `EventEntity` y `ConversationMessage`.

**Poda de `package.json`.** Después de copiar, se quitan las dependencias que ya no importa nadie en `src/` (se confirma con un grep por nombre de paquete antes de borrar cada una) y se regenera el lockfile con `pnpm install`.

## Risks / Trade-offs

- [Algún archivo copiado importa un helper no listado (por ejemplo, otro util de `common/`)] → se copia `common/` completo y `tsc --noEmit` detecta lo que falte. Se copia solo el archivo faltante, no el módulo entero.
- [Los specs copiados referencian dominio (fixtures de tickets o facturas)] → los que no compilen o prueben dominio se borran. Se conservan los de inbound, outbound, session, batcher y shared.
- [El lock y el batcher son en memoria, de una sola instancia] → igual que en CHILI. Queda anotado; para varias réplicas hace falta un lock en Postgres.
- [Tokens con vigencia de 365 días, heredado de CHILI] → aceptable mientras sea un panel interno; bajarla si se expone a más usuarios.
- [Divergencia con CHILI con el tiempo] → aceptado. Si los arreglos al contrato se vuelven frecuentes, conviene extraer un paquete compartido.

## Migration Plan

No aplica: proyecto nuevo y sin datos. El rollback es borrar `src/` y los archivos de configuración copiados.
