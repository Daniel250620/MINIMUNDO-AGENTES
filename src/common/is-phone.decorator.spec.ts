import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsPhone } from './is-phone.decorator';

class Dto {
  @IsPhone()
  phone!: string;
}

const check = (phone: unknown) => {
  const dto = plainToInstance(Dto, { phone });
  return { phone: dto.phone, ok: validateSync(dto).length === 0 };
};

describe('IsPhone', () => {
  it('normaliza 10 dígitos y formatos de WhatsApp a E.164', () => {
    expect(check('55 1234 5678')).toEqual({
      phone: '+5215512345678',
      ok: true,
    });
    expect(check('525512345678')).toEqual({
      phone: '+5215512345678',
      ok: true,
    });
  });

  it('respeta números de otro país', () => {
    expect(check('+14155551234')).toEqual({ phone: '+14155551234', ok: true });
  });

  it('rechaza teléfonos cortos o sin dígitos', () => {
    expect(check('12345').ok).toBe(false);
    expect(check('abc').ok).toBe(false);
  });
});
