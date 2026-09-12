import { requestBackend } from '@/services/backendClient'

export interface QueryError {
  message: string
  code?: string
}

export interface QueryResponse<T> {
  data: T
  error: QueryError | null
  count: number | null
}

interface Filter {
  op: string
  column: string
  value: unknown
}

interface SerializedQuery {
  table: string
  select?: string
  selectOptions?: { count?: 'exact'; head?: boolean }
  filters: Filter[]
  orders: Array<{ column: string; ascending: boolean }>
  limit?: number | null
  offset?: number | null
  mutation?: { type: 'insert' | 'update' | 'delete' | 'upsert'; payload?: unknown; onConflict?: string } | null
  returning?: boolean
  single?: 'one' | 'maybe' | null
}

export class HttpQueryBuilder<T = unknown> {
  private selectColumns = '*'
  private selectOptions: { count?: 'exact'; head?: boolean } | undefined
  private filters: Filter[] = []
  private orders: Array<{ column: string; ascending: boolean }> = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private mutation: SerializedQuery['mutation'] = null
  private returning = false
  private wantsSingle: 'one' | 'maybe' | null = null

  constructor(private readonly tableName: string) {}

  select(columns: string = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selectColumns = columns
    this.selectOptions = options
    this.returning = true
    return this
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: 'eq', column, value })
    return this
  }

  neq(column: string, value: unknown): this {
    this.filters.push({ op: 'neq', column, value })
    return this
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ op: 'in', column, value })
    return this
  }

  is(column: string, value: unknown): this {
    this.filters.push({ op: 'is', column, value })
    return this
  }

  gt(column: string, value: unknown): this {
    this.filters.push({ op: 'gt', column, value })
    return this
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ op: 'gte', column, value })
    return this
  }

  lt(column: string, value: unknown): this {
    this.filters.push({ op: 'lt', column, value })
    return this
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ op: 'lte', column, value })
    return this
  }

  ilike(column: string, value: unknown): this {
    this.filters.push({ op: 'ilike', column, value })
    return this
  }

  like(column: string, value: unknown): this {
    this.filters.push({ op: 'like', column, value })
    return this
  }

  not(column: string, operator: string, value: unknown): this {
    this.filters.push({
      op: operator === 'is' ? 'not.is' : operator === 'in' ? 'not.in' : `not.${operator}`,
      column,
      value,
    })
    return this
  }

  or(expression: string): this {
    this.filters.push({ op: 'or', column: '', value: expression })
    return this
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number): this {
    this.limitCount = count
    return this
  }

  range(from: number, to: number): this {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  insert(payload: unknown): this {
    this.mutation = { type: 'insert', payload }
    return this
  }

  update(payload: unknown): this {
    this.mutation = { type: 'update', payload }
    return this
  }

  upsert(payload: unknown, options?: { onConflict?: string }): this {
    this.mutation = { type: 'upsert', payload, onConflict: options?.onConflict }
    return this
  }

  delete(): this {
    this.mutation = { type: 'delete' }
    return this
  }

  single(): Promise<{ data: T; error: null; count: number | null } | { data: null; error: QueryError; count: number | null }> {
    this.wantsSingle = 'one'
    return this.execute() as ReturnType<this['single']>
  }

  maybeSingle(): Promise<QueryResponse<T | null>> {
    this.wantsSingle = 'maybe'
    return this.execute() as Promise<QueryResponse<T | null>>
  }

  then<TResult1 = QueryResponse<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as never, onrejected)
  }

  private async execute(): Promise<QueryResponse<T[] | T | null>> {
    return requestBackend<QueryResponse<T[] | T | null>>('/api/data/query', {
      method: 'POST',
      body: JSON.stringify({
        table: this.tableName,
        select: this.selectColumns,
        selectOptions: this.selectOptions,
        filters: this.filters,
        orders: this.orders,
        limit: this.limitCount,
        offset: this.offsetCount,
        mutation: this.mutation,
        returning: this.returning,
        single: this.wantsSingle,
      } satisfies SerializedQuery),
    })
  }
}

export function from<T = unknown>(tableName: string): HttpQueryBuilder<T> {
  return new HttpQueryBuilder<T>(tableName)
}
