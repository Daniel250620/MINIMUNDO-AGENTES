# user-auth Specification

## Purpose

Permite que un front administre el bot con sesión: login con JWT, rutas protegidas por defecto y administración de usuarios y roles.

## Requirements

### Requirement: Login con JWT
El sistema SHALL autenticar con `POST /auth/login` (correo y contraseña) y devolver un JWT, los datos del usuario sin contraseña y los permisos de su rol.

#### Scenario: Credenciales válidas
- **WHEN** un usuario activo con rol activo envía su correo y contraseña correctos
- **THEN** el sistema responde con un token y el usuario, sin el campo `password`

#### Scenario: Credenciales inválidas
- **WHEN** la contraseña no coincide
- **THEN** el sistema responde 401

### Requirement: Rutas protegidas por defecto
Toda ruta MUST requerir un JWT válido salvo las marcadas como públicas: el login, la verificación y recepción del webhook de WhatsApp y `current-version`.

#### Scenario: Ruta protegida sin token
- **WHEN** se llama `/user/paginate` o `/files/:id` sin token
- **THEN** el sistema responde 401

#### Scenario: Webhook sin token
- **WHEN** Meta llama el webhook sin token JWT
- **THEN** el sistema no lo rechaza por auth (aplica solo la validación de firma de Meta)

### Requirement: Secreto JWT obligatorio
El sistema MUST NOT arrancar si `JWT_SECRET` no está configurado.

#### Scenario: Sin secreto
- **WHEN** la app arranca sin `JWT_SECRET`
- **THEN** el arranque falla con un error que nombra la variable

### Requirement: Roles y admin inicial
Al arrancar, el sistema SHALL crear los roles base (Administrador, View All) si no existen y, solo cuando `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` están definidas, un usuario Administrador con esas credenciales si no existe.

#### Scenario: Sin variables de admin
- **WHEN** la app arranca sin `SEED_ADMIN_EMAIL` o `SEED_ADMIN_PASSWORD`
- **THEN** se crean los roles y no se crea ningún usuario

#### Scenario: Con variables de admin
- **WHEN** la app arranca con ambas variables y el correo no existe
- **THEN** se crea el usuario con rol Administrador y su contraseña hasheada

### Requirement: Actualización de usuarios
`PATCH /user/:id` SHALL actualizar los datos del usuario normalizando nombre y apellidos, aunque algún apellido sea nulo.

#### Scenario: Apellido nulo
- **WHEN** se actualiza el nombre de un usuario cuyo segundo apellido es nulo
- **THEN** el sistema responde 200, guarda el nombre normalizado y deja el apellido en nulo
