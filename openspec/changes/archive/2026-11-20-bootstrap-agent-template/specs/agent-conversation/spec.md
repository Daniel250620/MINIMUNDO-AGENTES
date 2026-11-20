# Spec Delta

## Purpose

Orquesta cada turno de conversación de WhatsApp con un agente de IA: agrupa los mensajes del usuario, evita turnos concurrentes por usuario, persiste la sesión y su historial en Postgres y permite registrar agentes nuevos con el mismo contrato.

## ADDED Requirements

### Requirement: Agrupación de mensajes consecutivos
El sistema SHALL agrupar los mensajes que un mismo usuario envía en ráfaga y procesarlos como un solo turno del agente.

#### Scenario: Ráfaga de mensajes
- **WHEN** un usuario envía varios mensajes seguidos dentro de la ventana de agrupación
- **THEN** el agente recibe todos esos mensajes en un único turno y responde una sola vez

### Requirement: Un turno a la vez por usuario
El sistema MUST procesar como máximo un turno de agente a la vez por usuario; los mensajes que lleguen durante un turno en curso se procesan después, sin perderse.

#### Scenario: Mensaje durante un turno en curso
- **WHEN** llega un mensaje de un usuario mientras su turno anterior sigue ejecutándose
- **THEN** el nuevo mensaje se procesa cuando termina el turno anterior y no en paralelo

#### Scenario: Usuarios distintos
- **WHEN** dos usuarios distintos escriben al mismo tiempo
- **THEN** sus turnos se procesan de forma independiente

### Requirement: Persistencia de sesión del agente
El sistema SHALL guardar en Postgres la sesión del agente por usuario (estado y eventos) para que la conversación continúe con su historial y estado tras reinicios del servicio.

#### Scenario: Continuidad tras reinicio
- **WHEN** el servicio se reinicia y el mismo usuario vuelve a escribir
- **THEN** el agente responde con el historial y el estado previos de esa sesión

#### Scenario: Usuario nuevo
- **WHEN** escribe un número que no tiene sesión
- **THEN** el sistema crea una sesión nueva para ese usuario

### Requirement: Registro de mensajes de la conversación
El sistema SHALL registrar cada mensaje entrante y saliente de la conversación con su remitente, contenido y archivo adjunto cuando exista.

#### Scenario: Mensaje con adjunto
- **WHEN** el usuario envía una imagen o documento
- **THEN** el mensaje queda registrado con referencia al archivo almacenado

### Requirement: Agente de ejemplo
El sistema SHALL incluir un agente de ejemplo que responda mensajes de texto usando el contrato de salida y exponga al menos una tool, como plantilla para nuevos agentes.

#### Scenario: Saludo
- **WHEN** un usuario envía "hola"
- **THEN** el agente de ejemplo responde con un mensaje de salida válido

#### Scenario: Uso de tool
- **WHEN** el usuario pide algo que la tool de ejemplo resuelve
- **THEN** el agente invoca la tool y usa su resultado en la respuesta

### Requirement: Fallo del agente
El sistema MUST enviar al usuario una respuesta fija de error cuando el turno del agente falla después de los reintentos, y no dejar la conversación bloqueada.

#### Scenario: Error del modelo
- **WHEN** el modelo falla en todos los reintentos durante un turno
- **THEN** el usuario recibe el mensaje fijo de error y su siguiente mensaje se procesa normalmente
