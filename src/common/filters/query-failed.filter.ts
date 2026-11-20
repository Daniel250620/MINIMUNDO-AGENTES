import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

// ponytail: map more Postgres codes here if they start showing up as raw 500s
@Catch(QueryFailedError)
export class QueryFailedFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError & { code?: string }, host: ArgumentsHost) {
    switch (exception.code) {
      case '23503':
        return super.catch(
          new BadRequestException(
            'No se puede eliminar: el registro tiene datos relacionados',
          ),
          host,
        );
      case '23505':
        return super.catch(
          new ConflictException('Ya existe un registro con esos datos'),
          host,
        );
      case '22P02':
        return super.catch(
          new BadRequestException('Proporciona un valor valido'),
          host,
        );
      case '23502':
        return super.catch(
          new BadRequestException('Falta un campo obligatorio'),
          host,
        );
    }

    super.catch(exception, host);
  }
}
