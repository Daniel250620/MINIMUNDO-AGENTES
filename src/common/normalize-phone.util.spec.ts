import { normalizePhone } from './normalize-phone.util';

describe('normalizePhone', () => {
  it.each([
    ['9515841623', '+5219515841623'],
    ['5219515841623', '+5219515841623'],
    ['529515841623', '+5219515841623'],
    ['+5219515841623', '+5219515841623'],
    ['+52 951 584 1623', '+5219515841623'],
    ['14155550123', '+14155550123'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });
});
