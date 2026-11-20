# Spec Delta

## Purpose

Conecta el backend con WhatsApp Cloud API: recibe el webhook de Meta, normaliza los mensajes entrantes a un contrato único y envía las respuestas de los agentes con el mismo contrato de salida que usa CHILI.

## ADDED Requirements

### Requirement: Verificación del webhook
El sistema SHALL responder la verificación `GET` del webhook de Meta devolviendo `hub.challenge` cuando `hub.mode` es `subscribe` y `hub.verify_token` coincide con el token configurado, sin requerir autenticación.

#### Scenario: Token correcto
- **WHEN** Meta llama `GET /whatsapp/webhook` con `hub.mode=subscribe` y el `hub.verify_token` configurado
- **THEN** el sistema responde 200 con el valor de `hub.challenge`

#### Scenario: Token incorrecto
- **WHEN** Meta llama `GET /whatsapp/webhook` con un `hub.verify_token` distinto
- **THEN** el sistema responde 403 y no devuelve el challenge

### Requirement: Validación de firma del webhook
El sistema MUST validar la cabecera `X-Hub-Signature-256` (HMAC-SHA256 del cuerpo crudo con el app secret) en cada `POST` del webhook y rechazar las peticiones sin firma o con firma inválida antes de procesarlas.

#### Scenario: Firma válida
- **WHEN** llega un `POST /whatsapp/webhook` cuya firma coincide con el cuerpo crudo
- **THEN** el sistema acepta el evento y responde 200

#### Scenario: Firma ausente o inválida
- **WHEN** llega un `POST /whatsapp/webhook` sin `X-Hub-Signature-256` o con una firma que no coincide
- **THEN** el sistema responde 401 y no procesa ningún mensaje

### Requirement: Contrato de mensaje entrante
El sistema SHALL normalizar cada mensaje del webhook al contrato de entrada de CHILI (remitente, wamid, nombre de contacto, tipo, texto, mensaje citado, media, selección de botón o lista, ubicación) y marcar como `unsupported` los tipos no soportados conservando el tipo original.

#### Scenario: Mensaje de texto
- **WHEN** el webhook trae un mensaje `text`
- **THEN** se produce un mensaje entrante con `type` texto, el teléfono del remitente y el contenido en `text`

#### Scenario: Respuesta a botón o lista
- **WHEN** el webhook trae un mensaje `interactive` o `button`
- **THEN** el mensaje entrante incluye `selection` con el id y el título elegidos

#### Scenario: Tipo no soportado
- **WHEN** el webhook trae un tipo que el contrato no maneja (por ejemplo, sticker)
- **THEN** el mensaje entrante tiene `type` `unsupported` y `rawType` con el tipo original

#### Scenario: Notificaciones de estado
- **WHEN** el webhook trae solo actualizaciones de estado (entregado, leído) sin mensajes
- **THEN** el sistema responde 200 y no inicia ningún turno de agente

### Requirement: Contrato de mensaje saliente
El sistema SHALL enviar respuestas a WhatsApp solo mediante el contrato de salida de CHILI (`text`, `buttons`, `list`, `image`, `document`) y MUST validar cada mensaje contra los límites de WhatsApp antes de enviarlo.

#### Scenario: Respuesta de texto
- **WHEN** un agente produce un mensaje de salida `text`
- **THEN** el sistema lo envía al remitente como mensaje de texto de WhatsApp

#### Scenario: Mensaje saliente inválido
- **WHEN** un agente produce un mensaje de salida que excede los límites de WhatsApp (por ejemplo, más botones de los permitidos)
- **THEN** el sistema no lo envía tal cual y registra el error de validación
