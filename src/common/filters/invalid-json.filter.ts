import { ArgumentsHost, BadRequestException, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

// Nest convierte el SyntaxError de body-parser en un 400 con el texto en inglés de Node.
const JSON_PARSE_ERROR = /\bJSON\b|^Unexpected (token|end)/i;

@Catch(BadRequestException)
export class InvalidJsonFilter extends BaseExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const { message } = exception.getResponse() as { message?: unknown };
    if (typeof message === 'string' && JSON_PARSE_ERROR.test(message)) {
      return super.catch(
        new BadRequestException(
          'El cuerpo de la petición no es un JSON válido',
        ),
        host,
      );
    }
    super.catch(exception, host);
  }
}
