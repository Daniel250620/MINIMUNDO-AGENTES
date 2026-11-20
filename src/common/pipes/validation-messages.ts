import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

const LABELS: Record<string, string> = {
  email: 'El correo',
  password: 'La contraseña',
  name: 'El nombre',
  nombre: 'El nombre',
  lastName: 'El apellido paterno',
  secondLastName: 'El apellido materno',
  phone: 'El teléfono',
  address: 'La dirección',
  description: 'La descripción',
  title: 'El título',
  text: 'El texto',
  rfc: 'El RFC',
  cp: 'El código postal',
  postalCode: 'El código postal',
  folio: 'El folio',
  total: 'El total',
  status: 'El estatus',
  priority: 'La prioridad',
  rolId: 'El rol',
  branchId: 'La sucursal',
  areaId: 'El área',
  categoryId: 'La categoría',
  ticketId: 'El ticket',
  csfId: 'La constancia fiscal',
  latitude: 'La latitud',
  longitude: 'La longitud',
  limit: 'El límite',
  offset: 'El desplazamiento',
  search: 'La búsqueda',
};

const label = (prop: string) => LABELS[prop] ?? `El campo "${prop}"`;

type Rule = [
  key: string,
  re: RegExp,
  build: (l: string, m: string[]) => string,
];

// Cada regla solo traduce el mensaje por defecto de class-validator; los
// mensajes personalizados de los DTOs no coinciden y se respetan tal cual.
const RULES: Rule[] = [
  ['isString', /must be a string$/, (l) => `${l} debe ser texto`],
  ['isNotEmpty', /should not be empty$/, (l) => `${l} no debe estar vacío`],
  ['arrayNotEmpty', /should not be empty$/, (l) => `${l} no debe estar vacío`],
  ['isEmail', /must be an email$/, (l) => `${l} debe ser un correo válido`],
  ['isUuid', /must be a UUID$/, (l) => `${l} debe ser un UUID válido`],
  [
    'maxLength',
    /must be shorter than or equal to (\d+) characters$/,
    (l, m) => `${l} debe tener como máximo ${m[1]} caracteres`,
  ],
  [
    'minLength',
    /must be longer than or equal to (\d+) characters$/,
    (l, m) => `${l} debe tener al menos ${m[1]} caracteres`,
  ],
  [
    'length',
    /must be longer than or equal to (\d+) and shorter than or equal to (\d+) characters$/,
    (l, m) =>
      m[1] === m[2]
        ? `${l} debe tener exactamente ${m[1]} caracteres`
        : `${l} debe tener entre ${m[1]} y ${m[2]} caracteres`,
  ],
  [
    'length',
    /must be (?:longer|shorter) than or equal to (\d+) characters$/,
    (l, m) => `${l} debe tener ${m[1]} caracteres`,
  ],
  [
    'matches',
    /must match .* regular expression$/,
    (l) => `${l} no tiene un formato válido`,
  ],
  ['isNumber', /must be a number/, (l) => `${l} debe ser un número`],
  [
    'isInt',
    /must be an integer number$/,
    (l) => `${l} debe ser un número entero`,
  ],
  [
    'isPositive',
    /must be a positive number$/,
    (l) => `${l} debe ser un número positivo`,
  ],
  [
    'min',
    /must not be less than (.+)$/,
    (l, m) => `${l} debe ser como mínimo ${m[1]}`,
  ],
  [
    'max',
    /must not be greater than (.+)$/,
    (l, m) => `${l} debe ser como máximo ${m[1]}`,
  ],
  [
    'isIn',
    /must be one of the following values: (.+)$/,
    (l, m) => `${l} debe ser uno de los siguientes valores: ${m[1]}`,
  ],
  [
    'isEnum',
    /must be one of the following values: (.+)$/,
    (l, m) => `${l} debe ser uno de los siguientes valores: ${m[1]}`,
  ],
  [
    'isDateString',
    /must be a valid ISO 8601 date string$/,
    (l) => `${l} debe ser una fecha válida`,
  ],
  [
    'isBoolean',
    /must be a boolean value$/,
    (l) => `${l} debe ser verdadero o falso`,
  ],
  ['isObject', /must be an object$/, (l) => `${l} debe ser un objeto`],
  ['isArray', /must be an array$/, (l) => `${l} debe ser una lista`],
  ['isUrl', /must be a URL address$/, (l) => `${l} debe ser una URL válida`],
  [
    'isLatitude',
    /must be a latitude/,
    (l) => `${l} debe ser una latitud válida`,
  ],
  [
    'isLongitude',
    /must be a longitude/,
    (l) => `${l} debe ser una longitud válida`,
  ],
  [
    'whitelistValidation',
    /should not exist$/,
    (l) => `${l} no es un campo permitido`,
  ],
];

export function translateConstraint(
  property: string,
  key: string,
  message: string,
): string {
  const l = label(property);
  for (const [ruleKey, re, build] of RULES) {
    if (ruleKey !== key) continue;
    const m = re.exec(message);
    if (m) return build(l, m);
  }
  return message;
}

function collect(errors: ValidationError[], out: string[]): string[] {
  for (const e of errors) {
    let entries = Object.entries(e.constraints ?? {});
    // Valor ausente: basta el aviso de "requerido"; el resto de reglas es ruido.
    if (e.value == null) {
      const presence = entries.find(
        ([k]) => k === 'isNotEmpty' || k === 'isString',
      );
      if (presence) entries = [presence];
    }
    for (const [key, msg] of entries) {
      out.push(translateConstraint(e.property, key, msg));
    }
    if (e.children?.length) collect(e.children, out);
  }
  return out;
}

export const spanishValidationExceptionFactory = (errors: ValidationError[]) =>
  new BadRequestException(collect(errors, []));
