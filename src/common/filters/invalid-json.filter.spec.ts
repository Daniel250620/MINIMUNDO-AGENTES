import { BadRequestException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { InvalidJsonFilter } from './invalid-json.filter';

describe('InvalidJsonFilter', () => {
  const spy = jest
    .spyOn(BaseExceptionFilter.prototype, 'catch')
    .mockImplementation(() => undefined);
  const filter = new InvalidJsonFilter();
  const sent = () => spy.mock.calls.at(-1)![0] as BadRequestException;

  it('traduce el error de JSON inválido', () => {
    filter.catch(
      new BadRequestException(
        `Unexpected token 'n', "nojson" is not valid JSON`,
      ),
      {} as any,
    );
    expect(sent().message).toBe(
      'El cuerpo de la petición no es un JSON válido',
    );
  });

  it('deja pasar el resto de los 400', () => {
    const original = new BadRequestException(['El nombre es requerido']);
    filter.catch(original, {} as any);
    expect(sent()).toBe(original);
  });
});
