# Proposal

## Why

Minimundo necesita un backend NestJS para agentes de IA sobre WhatsApp, y CHILI (`chili-agentes-ia-back`) ya tiene resuelta esa infraestructura (webhook de WhatsApp, contrato de mensajes, sesiones ADK en TypeORM, archivos en S3). Partir de cero duplicaría trabajo y rompería el contrato de mensajes que ya usamos; copiar CHILI entero arrastraría todo su dominio (facturación, casos, tickets, auth).

## What Changes

- Nuevo proyecto NestJS en la raíz de este repo, creado copiando archivos de CHILI por `rsync` (sin reescribirlos) y podando lo que es de dominio.
- Se conservan tal cual: módulo `files` (S3), módulo `whatsapp`, y de `conversation` las piezas `inbound`, `outbound`, `session` (TypeORM session service, user-lock, session-state), `entities` (adk-session, adk-event, conversation-message), `runner`, `batcher`, `agents/shared`, más `common` y la configuración del proyecto (package.json, tsconfig, nest-cli, eslint, prettier, Dockerfile, docker-compose).
- Se reescriben en versión mínima: `conversation.module.ts`, `conversation.service.ts` (flujo inbound → lock → runner → outbound), `replies.ts`, `app.module.ts` y `main.ts`.
- Se eliminan las dependencias a dominio de CHILI: `HumanAttentionNotifier` (casos), eventos del panel de chat y la relación de usuarios con sucursales (`Branch`).
- Se copian `auth`, `users` y `rols` de CHILI para que un front pueda autenticarse: JWT con guard global, `@Public()` en el webhook y el login, roles base (Administrador, View All) y admin inicial por variables de entorno (sin credenciales en código).
- El webhook de WhatsApp queda público y valida la firma `X-Hub-Signature-256` de Meta (en CHILI no se validaba; esto es nuevo).
- Se agrega un agente de ejemplo (`agents/assistant`) con prompt y una tool trivial, con la misma forma que el router de CHILI, como patrón para crear agentes nuevos.
- Se agrega `.env.example` con los nombres de variables requeridas (sin valores).
- Fuera de alcance: subir adjuntos de WhatsApp a S3, panel de chat (gateway/socket), feedback, ticket-retry, billing, case, extraction, proforma, workflows de CI.

## Capabilities

### New Capabilities
- `whatsapp-messaging`: recepción del webhook de WhatsApp Cloud API (verificación y firma), contrato de mensajes entrantes y salientes, y envío de respuestas.
- `agent-conversation`: orquestación de un turno de conversación con un agente ADK: agrupación de mensajes, bloqueo por usuario, persistencia de sesión y eventos en Postgres vía TypeORM, y registro de agentes.
- `file-storage`: carga y obtención de archivos en S3 con su registro en base de datos.
- `user-auth`: login con JWT, protección por defecto de todas las rutas y administración de usuarios y roles para el front.

### Modified Capabilities
- (ninguna; el repo no tiene specs previas)

## Impact

- Código: todo `src/` es nuevo en este repo; el origen es `../CHILI/chili-agentes-ia-back` (solo lectura, no se modifica).
- Dependencias: `@google/adk`, `@google/genai`, `@nestjs/typeorm`, `typeorm`, `pg`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`; `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`; se podan las de dominio (PDF, OCR, QR, socket.io, etc.).
- Sistemas externos: WhatsApp Cloud API (Meta), Gemini, Postgres, S3.
- Secretos: no se copia `.env`; cada variable se configura a mano a partir de `.env.example`.
