import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { PaginationDto } from './dto/pagination.dto';

export interface ListQueryConfig {
  /** Alias of the root entity in the query builder, e.g. 'ticket'. */
  alias: string;
  /** Field paths (aliased column, e.g. 'ticket.phone') checked by `search`. */
  search?: string[];
  /** Subset of `search` compared with non-digits stripped from both sides. */
  phoneFields?: string[];
  /** Whitelist: frontend column key -> aliased column/expression. Anything else is ignored. */
  sort?: Record<string, string>;
  /** Used when `sort` is absent or not in the whitelist. Defaults to `<alias>.createdAt`. */
  defaultSort?: string;
}

/** Escapes LIKE wildcards (`%`, `_`) and the escape char so the term matches literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Applies only `search` (multi-word AND, each word OR-matched across the configured fields).
 * Separate from `applyListQuery` for aggregates that must not be sorted or paginated.
 */
export function applySearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  search: string,
  config: Pick<ListQueryConfig, 'search' | 'phoneFields'>,
): SelectQueryBuilder<T> {
  const words = search.trim() === '' ? [] : search.trim().split(/\s+/);
  words.forEach((word, wordIndex) => {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    (config.search ?? []).forEach((field, fieldIndex) => {
      const param = `search_${wordIndex}_${fieldIndex}`;
      if (config.phoneFields?.includes(field)) {
        const digits = word.replace(/\D/g, '');
        if (digits === '') return; // word has no digits: skip this phone field
        conditions.push(
          `regexp_replace(${field}, '\\D', '', 'g') ILIKE :${param}`,
        );
        params[param] = `%${digits}%`;
      } else {
        conditions.push(`${field} ILIKE :${param} ESCAPE '\\'`);
        params[param] = `%${escapeLike(word)}%`;
      }
    });

    if (conditions.length > 0) {
      qb.andWhere(`(${conditions.join(' OR ')})`, params);
    }
  });
  return qb;
}

/**
 * Applies `search`, `sort`/`order` (whitelisted column keys only) and pagination to a query builder.
 * Mutates and returns `qb` for chaining.
 */
export function applyListQuery<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  dto: PaginationDto,
  config: ListQueryConfig,
): SelectQueryBuilder<T> {
  const { limit = 10, offset = 0, search = '', sort, order = 'asc' } = dto;

  applySearch(qb, search, config);

  const sortColumn = sort ? config.sort?.[sort] : undefined;
  const direction = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  if (sortColumn) {
    qb.orderBy(sortColumn, direction);
  } else {
    qb.orderBy(config.defaultSort ?? `${config.alias}.createdAt`, 'DESC');
  }
  qb.addOrderBy(`${config.alias}.id`, 'ASC');

  qb.take(limit).skip(offset);

  return qb;
}
