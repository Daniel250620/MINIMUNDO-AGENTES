import { applyListQuery, applySearch } from './list-query.util';

function fakeQueryBuilder() {
  return {
    wheres: [] as { sql: string; params: Record<string, unknown> }[],
    orderBys: [] as { sort: string; dir: string }[],
    limit: undefined as number | undefined,
    offset: undefined as number | undefined,
    andWhere(sql: string, params: Record<string, unknown> = {}) {
      this.wheres.push({ sql, params });
      return this;
    },
    orderBy(sort: string, dir: string) {
      this.orderBys = [{ sort, dir }];
      return this;
    },
    addOrderBy(sort: string, dir: string) {
      this.orderBys.push({ sort, dir });
      return this;
    },
    take(n: number) {
      this.limit = n;
      return this;
    },
    skip(n: number) {
      this.offset = n;
      return this;
    },
  };
}

describe('applyListQuery', () => {
  const config = {
    alias: 'ticket',
    search: ['ticket.externalTicketId', 'ticket.phone'],
    phoneFields: ['ticket.phone'],
    sort: { total: 'ticket.total', 'branch.name': 'branch.name' },
  };

  it('adds one AND clause per search word', () => {
    const qb = fakeQueryBuilder();
    applyListQuery(qb as any, { search: 'T-100 Norte' } as any, config);

    expect(qb.wheres).toHaveLength(2);
    expect(qb.wheres[0].sql).toContain('ticket.externalTicketId ILIKE');
    expect(qb.wheres[0].params).toEqual(
      expect.objectContaining({ search_0_0: '%T-100%' }),
    );
  });

  it('escapes LIKE wildcards so % and _ match literally', () => {
    const qb = fakeQueryBuilder();
    applyListQuery(qb as any, { search: '50%_a\\b' } as any, config);

    expect(qb.wheres[0].sql).toContain("ILIKE :search_0_0 ESCAPE '\\'");
    expect(qb.wheres[0].params.search_0_0).toBe('%50\\%\\_a\\\\b%');
  });

  it('compares phone fields with digits only and skips a word with no digits', () => {
    const qb = fakeQueryBuilder();
    applyListQuery(qb as any, { search: '55-1234' } as any, config);

    expect(qb.wheres).toHaveLength(1);
    const sql = qb.wheres[0].sql;
    expect(sql).toContain("regexp_replace(ticket.phone, '\\D', '', 'g') ILIKE");
    expect(qb.wheres[0].params.search_0_1).toBe('%551234%');

    const qbNoDigits = fakeQueryBuilder();
    applyListQuery(qbNoDigits as any, { search: 'abc' } as any, config);
    // phone field dropped (no digits), plain field still checked
    expect(qbNoDigits.wheres[0].sql).not.toContain('normalizedPhone');
  });

  it('ignores an unknown sort key and falls back to default createdAt DESC', () => {
    const qb = fakeQueryBuilder();
    applyListQuery(qb as any, { sort: 'priority' } as any, config);

    expect(qb.orderBys[0]).toEqual({ sort: 'ticket.createdAt', dir: 'DESC' });
    expect(qb.orderBys[1]).toEqual({ sort: 'ticket.id', dir: 'ASC' });
  });

  it('defaults order to ascending when sort is whitelisted and order is omitted', () => {
    const qb = fakeQueryBuilder();
    applyListQuery(qb as any, { sort: 'total' } as any, config);

    expect(qb.orderBys[0]).toEqual({ sort: 'ticket.total', dir: 'ASC' });
  });
});

describe('applySearch', () => {
  it('adds only the search conditions: no sort and no pagination', () => {
    const qb = fakeQueryBuilder();
    applySearch(qb as any, 'T-100', { search: ['ticket.externalTicketId'] });

    expect(qb.wheres).toHaveLength(1);
    expect(qb.orderBys).toHaveLength(0);
    expect(qb.limit).toBeUndefined();
    expect(qb.offset).toBeUndefined();
  });
});
