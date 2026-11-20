import { trimDanglingHistory } from './trim-dangling-history';

const run = (contents: any[]) => {
  const request: any = { contents };
  trimDanglingHistory({ request });
  return request.contents.map((c: any) => c.role);
};
const fnResp = {
  role: 'user',
  parts: [{ functionResponse: { name: 'x', response: {} } }],
};

describe('trimDanglingHistory', () => {
  it('descarta turnos model/tool iniciales hasta el primer user limpio', () => {
    expect(
      run([
        { role: 'model', parts: [{ text: 'a' }] },
        fnResp,
        { role: 'user', parts: [{ text: 'hola' }] },
        { role: 'model', parts: [{ text: 'b' }] },
      ]),
    ).toEqual(['user', 'model']);
  });

  it('deja intacto un historial ya válido', () => {
    expect(
      run([
        { role: 'user', parts: [{ text: 'hola' }] },
        { role: 'model', parts: [{ text: 'b' }] },
      ]),
    ).toEqual(['user', 'model']);
  });
});
