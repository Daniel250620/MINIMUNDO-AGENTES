# Spec Delta

## Purpose

Guarda archivos (cargas por API) en S3 con un registro en base de datos, y entrega URLs firmadas temporales para leerlos sin exponer el bucket.

## ADDED Requirements

### Requirement: Carga de archivos
El sistema SHALL recibir un archivo por `POST /files/upload`, guardarlo en S3 con una llave única y registrar sus metadatos (nombre, tipo, tamaño, llave) en base de datos.

#### Scenario: Carga exitosa
- **WHEN** se envía un archivo a `POST /files/upload`
- **THEN** el archivo queda en S3, se crea su registro y la respuesta incluye su id

### Requirement: Lectura con URL firmada
El sistema SHALL devolver para `GET /files/:id` una URL firmada de S3 con vigencia limitada (una hora) y MUST rechazar ids que no sean UUID válidos.

#### Scenario: Archivo existente
- **WHEN** se pide `GET /files/:id` con el id de un archivo registrado
- **THEN** la respuesta incluye una URL firmada que expira en una hora

#### Scenario: Id inválido
- **WHEN** se pide `GET /files/:id` con un valor que no es UUID
- **THEN** el sistema responde 400

#### Scenario: Archivo inexistente
- **WHEN** se pide `GET /files/:id` con un UUID que no existe
- **THEN** el sistema responde 404

### Requirement: Eliminación de archivos
El sistema SHALL eliminar con `DELETE /files/:id` el objeto en S3 y su registro.

#### Scenario: Eliminación
- **WHEN** se llama `DELETE /files/:id` sobre un archivo existente
- **THEN** el objeto ya no está en S3 y su registro ya no existe

### Requirement: Endpoints de archivos autenticados
Los endpoints de `/files` MUST requerir un JWT válido.

#### Scenario: Acceso sin token
- **WHEN** se llama cualquier endpoint de `/files` sin cabecera de autorización
- **THEN** el sistema responde 401
