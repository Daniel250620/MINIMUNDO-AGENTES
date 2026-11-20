import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { normalizePhone } from './normalize-phone.util';

/** Normaliza a E.164 (`normalizePhone`) y luego valida; el servicio recibe el teléfono ya listo para comparar. */
export const IsPhone = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizePhone(value) : value,
    ),
    Matches(/^\+\d{10,15}$/, {
      message:
        'El teléfono debe tener 10 a 15 dígitos (ej. 5512345678 o +5215512345678)',
    }),
  );
