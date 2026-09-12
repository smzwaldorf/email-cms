import { query } from '#/lib/db'
import { RELATIONS, type RelationSpec } from '#/lib/relations'

export interface QueryError {
  message: string
  code?: string
}

export interface QueryResponse<T> {
  data: T
  error: QueryError | null
  count: number | null
}

type FilterOp = 'eq' | 'neq' | 'in' | 'is' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'like' | 'not.is' | 'not.in' | 'or'

interface Filter {
  op: FilterOp
  column: string
  value: unknown
}

export interface SerializedQuery {
  table: string
  select?: string
  selectOptions?: { count?: 'exact'; head?: boolean }
  filters?: Filter[]
  orders?: OrderBy[]
  limit?: number | null
  offset?: number | null
  mutation?: { type: 'insert' | 'update' | 'delete' | 'upsert'; payload?: unknown; onConflict?: string } | null
  returning?: boolean
  single?: 'one' | 'maybe' | null
}

interface OrderBy {
  column: string
  ascending: boolean
}

interface Embed {
  alias: string
  inner: boolean
  columns: string[] | '*'
  relation: RelationSpec
}

interface ParsedSelect {
  columns: string[]
  embeds: Embed[]
  count: 'exact' | null
  head: boolean
}

function translateOrExpression(tableName: string, expression: string): string {
  return expression
    .split(',')
    .map((part) => {
      const match = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\.(ilike|like|eq|neq)\.(.+)$/i)
      if (!match) {
        throw new Error(`Unsupported or() clause: ${part}`)
      }
      const column = qualify(tableName, match[1])
      const operator = match[2].toLowerCase() === 'eq' ? '=' : match[2].toLowerCase() === 'neq' ? '<>' : match[2].toUpperCase()
      const escaped = match[3].replace(/'/g, "''")
      return `${column} ${operator} '${escaped}'`
    })
    .join(' OR ')
}

function quoteIdent(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Invalid identifier: ${identifier}`)
  }
  return `"${identifier}"`
}

function qualify(tableName: string, column: string): string {
  if (column.includes('.')) {
    const [table, col] = column.split('.')
    return `${quoteIdent(table)}.${quoteIdent(col)}`
  }
  return `${quoteIdent(tableName)}.${quoteIdent(column)}`
}

function parseSelect(raw: string, tableName: string, options?: { count?: 'exact'; head?: boolean }): ParsedSelect {
  const embeds: Embed[] = []
  const columns: string[] = []
  const compact = raw.replace(/\s+/g, ' ').trim()
  if (compact === '' || compact === '*') {
    return { columns: ['*'], embeds, count: options?.count ?? null, head: options?.head === true }
  }

  // Commas inside relation projections belong to that relation, not the base table.
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === '(') depth += 1
    if (compact[index] === ')') depth -= 1
    if (depth < 0) throw new Error('Unbalanced select projection')
    if (compact[index] === ',' && depth === 0) {
      parts.push(compact.slice(start, index).trim())
      start = index + 1
    }
  }
  if (depth !== 0) throw new Error('Unbalanced select projection')
  parts.push(compact.slice(start).trim())
  for (const part of parts) {
    if (!part) continue
    const embedMatch = part.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:!(inner|left))?\s*\((.*)\)$/i)
    if (embedMatch) {
      const alias = embedMatch[1]
      const relation = RELATIONS[tableName]?.[alias]
      if (!relation) {
        throw new Error(`Unknown relation ${tableName}.${alias}`)
      }
      const innerCols = embedMatch[3].trim()
      embeds.push({
        alias,
        inner: embedMatch[2]?.toLowerCase() === 'inner',
        columns: innerCols === '*' ? '*' : innerCols.split(',').map((col) => col.trim()).filter(Boolean),
        relation,
      })
      continue
    }
    columns.push(part)
  }

  return {
    columns: columns.length > 0 ? columns : embeds.length > 0 ? [] : ['*'],
    embeds,
    count: options?.count ?? null,
    head: options?.head === true,
  }
}

function buildWhere(tableName: string, filters: Filter[], values: unknown[]): string {
  if (filters.length === 0) return ''
  const clauses = filters.map((filter) => {
    const column = qualify(tableName, filter.column)
    if (filter.op === 'is') {
      if (filter.value === null) return `${column} IS NULL`
      if (filter.value === true) return `${column} IS TRUE`
      if (filter.value === false) return `${column} IS FALSE`
      values.push(filter.value)
      return `${column} IS $${values.length}`
    }
    if (filter.op === 'in' || filter.op === 'not.in') {
      if (typeof filter.value === 'string' && /^\(\s*SELECT\b/i.test(filter.value)) {
        const subquery = filter.value.slice(1, -1)
        return filter.op === 'in' ? `${column} IN (${subquery})` : `${column} NOT IN (${subquery})`
      }
      const list = Array.isArray(filter.value) ? filter.value : []
      if (list.length === 0) return filter.op === 'in' ? 'FALSE' : 'TRUE'
      const placeholders = list.map((entry) => {
        values.push(entry)
        return `$${values.length}`
      })
      return filter.op === 'in'
        ? `${column} IN (${placeholders.join(', ')})`
        : `${column} NOT IN (${placeholders.join(', ')})`
    }
    if (filter.op === 'not.is') {
      if (filter.value === null) return `${column} IS NOT NULL`
      values.push(filter.value)
      return `${column} IS NOT $${values.length}`
    }
    if (filter.op === 'or') {
      return `(${String(filter.value)})`
    }
    if (filter.op === 'ilike' || filter.op === 'like') {
      values.push(filter.value)
      return `${column} ${filter.op.toUpperCase()} $${values.length}`
    }
    values.push(filter.value)
    const operator = {
      eq: '=',
      neq: '<>',
      gt: '>',
      gte: '>=',
      lt: '<',
      lte: '<=',
    }[filter.op]
    return `${column} ${operator} $${values.length}`
  })
  return `WHERE ${clauses.join(' AND ')}`
}

function isCountEmbed(embed: Embed): boolean {
  return Array.isArray(embed.columns) && embed.columns.length === 1 && embed.columns[0] === 'count'
}

function embedSelect(embed: Embed, tableName: string): string {
  const related = quoteIdent(embed.relation.table)
  if (isCountEmbed(embed)) {
    // Count in a correlated subquery so parents with zero children remain in the list
    // and parents with several children still produce exactly one result row.
    return `(SELECT jsonb_build_array(jsonb_build_object('count', count(*))) FROM ${related}
      WHERE ${related}.${quoteIdent(embed.relation.to)} = ${quoteIdent(tableName)}.${quoteIdent(embed.relation.from)}) AS ${quoteIdent(embed.alias)}`
  }
  if (embed.columns === '*') {
    return `to_jsonb(${related}.*) AS ${quoteIdent(embed.alias)}`
  }
  const fields = embed.columns
    .map((column) => `'${column}', ${related}.${quoteIdent(column)}`)
    .join(', ')
  return `jsonb_build_object(${fields}) AS ${quoteIdent(embed.alias)}`
}

export class QueryBuilder<T = unknown> {
  private selectSpec: ParsedSelect = { columns: ['*'], embeds: [], count: null, head: false }
  private filters: Filter[] = []
  private orders: OrderBy[] = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private mutation: { type: 'insert' | 'update' | 'delete' | 'upsert'; payload?: unknown; onConflict?: string } | null = null
  private returning = false
  private wantsSingle: 'one' | 'maybe' | null = null

  constructor(private readonly tableName: string) {}

  select(columns: string = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selectSpec = parseSelect(columns, this.tableName, options)
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
    if (operator === 'is') {
      this.filters.push({ op: 'not.is', column, value })
      return this
    }
    if (operator === 'in') {
      this.filters.push({ op: 'not.in', column, value })
      return this
    }
    throw new Error(`Unsupported not operator: ${operator}`)
  }

  or(expression: string): this {
    this.filters.push({ op: 'or', column: '', value: translateOrExpression(this.tableName, expression) })
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
    return (this.execute() as Promise<QueryResponse<T[]>>).then(onfulfilled, onrejected)
  }

  private async execute(): Promise<QueryResponse<T[] | T | null>> {
    try {
      if (this.mutation) {
        return await this.executeMutation()
      }
      return await this.executeSelect()
    } catch (error) {
      return {
        data: this.wantsSingle ? null : [],
        error: { message: error instanceof Error ? error.message : String(error) },
        count: null,
      }
    }
  }

  private async executeSelect(): Promise<QueryResponse<T[] | T | null>> {
    const values: unknown[] = []
    const table = quoteIdent(this.tableName)
    const selectList = this.buildSelectList()
    const joins = this.selectSpec.embeds.filter(embed => !isCountEmbed(embed)).map((embed) => {
      const joinType = embed.inner ? 'INNER JOIN' : 'LEFT JOIN'
      const related = quoteIdent(embed.relation.table)
      return `${joinType} ${related} ON ${related}.${quoteIdent(embed.relation.to)} = ${table}.${quoteIdent(embed.relation.from)}`
    })
    const where = buildWhere(this.tableName, this.filters, values)
    const order = this.orders.length
      ? `ORDER BY ${this.orders.map((entry) => `${qualify(this.tableName, entry.column)} ${entry.ascending ? 'ASC' : 'DESC'}`).join(', ')}`
      : ''
    const limit = this.limitCount !== null ? `LIMIT ${this.limitCount}` : ''
    const offset = this.offsetCount !== null ? `OFFSET ${this.offsetCount}` : ''
    const countSelect = this.selectSpec.count
      ? `, count(*) OVER() AS __count`
      : ''

    const sql = `
      SELECT ${this.selectSpec.head ? '1' : selectList}${countSelect}
      FROM ${table}
      ${joins.join('\n')}
      ${where}
      ${order}
      ${limit}
      ${offset}
    `

    const result = await query(sql, values)
    const count = this.selectSpec.count
      ? Number(result.rows[0]?.__count ?? result.rowCount ?? 0)
      : null
    const rows = this.selectSpec.head
      ? []
      : result.rows.map((row) => {
          const copy = { ...row } as Record<string, unknown>
          delete copy.__count
          return copy
        })

    return this.finalize(rows as T[], count)
  }

  private buildSelectList(): string {
    const table = quoteIdent(this.tableName)
    const base = this.selectSpec.columns.includes('*')
      ? this.selectSpec.embeds.length > 0
        ? `${table}.*`
        : '*'
      : this.selectSpec.columns.map((column) => qualify(this.tableName, column)).join(', ')
    const embeds = this.selectSpec.embeds.map((embed) => embedSelect(embed, this.tableName))
    return [base, ...embeds].filter(Boolean).join(', ')
  }

  private async executeMutation(): Promise<QueryResponse<T[] | T | null>> {
    if (!this.mutation) {
      throw new Error('No mutation queued')
    }
    const table = quoteIdent(this.tableName)
    const values: unknown[] = []
    let sql = ''

    if (this.mutation.type === 'insert' || this.mutation.type === 'upsert') {
      const rows = Array.isArray(this.mutation.payload) ? this.mutation.payload : [this.mutation.payload]
      if (rows.length === 0 || typeof rows[0] !== 'object' || rows[0] === null) {
        throw new Error('Insert payload must be an object or array of objects')
      }
      const columns = Object.keys(rows[0] as Record<string, unknown>)
      const valueGroups = rows.map((row) => {
        const record = row as Record<string, unknown>
        const placeholders = columns.map((column) => {
          values.push(record[column])
          return `$${values.length}`
        })
        return `(${placeholders.join(', ')})`
      })
      const conflictColumns = (this.mutation.onConflict ?? 'id').split(',').map(value => value.trim())
      const changes = columns.filter(column => !conflictColumns.includes(column))
      const conflict = this.mutation.type === 'upsert'
        ? `ON CONFLICT (${conflictColumns.map(quoteIdent).join(', ')}) ${changes.length
          ? `DO UPDATE SET ${changes.map(column => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(', ')}`
          : 'DO NOTHING'}`
        : ''
      sql = `INSERT INTO ${table} (${columns.map(quoteIdent).join(', ')}) VALUES ${valueGroups.join(', ')} ${conflict} ${this.returning ? 'RETURNING *' : ''}`
    } else if (this.mutation.type === 'update') {
      const record = this.mutation.payload as Record<string, unknown>
      const assignments = Object.entries(record).map(([column, value]) => {
        values.push(value)
        return `${quoteIdent(column)} = $${values.length}`
      })
      const where = buildWhere(this.tableName, this.filters, values)
      sql = `UPDATE ${table} SET ${assignments.join(', ')} ${where} ${this.returning ? 'RETURNING *' : ''}`
    } else {
      const where = buildWhere(this.tableName, this.filters, values)
      sql = `DELETE FROM ${table} ${where} ${this.returning ? 'RETURNING *' : ''}`
    }

    const result = await query(sql, values)
    return this.finalize((result.rows as T[]) ?? [], result.rowCount)
  }

  private finalize(rows: T[], count: number | null): QueryResponse<T[] | T | null> {
    if (this.wantsSingle) {
      if (rows.length === 0) {
        return {
          data: null,
          error: this.wantsSingle === 'one' ? { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' } : null,
          count,
        }
      }
      if (rows.length > 1 && this.wantsSingle === 'one') {
        return {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
          count,
        }
      }
      return { data: rows[0], error: null, count }
    }
    return { data: rows, error: null, count }
  }
}

export function from<T = unknown>(tableName: string): QueryBuilder<T> {
  return new QueryBuilder<T>(tableName)
}

export async function runSerializedQuery(spec: SerializedQuery): Promise<QueryResponse<unknown>> {
  const builder = from(spec.table)
  if (spec.select || spec.selectOptions) {
    builder.select(spec.select ?? '*', spec.selectOptions)
  }
  for (const filter of spec.filters ?? []) {
    if (filter.op === 'or') {
      builder.or(String(filter.value))
    } else if (filter.op === 'not.is') {
      builder.not(filter.column, 'is', filter.value)
    } else if (filter.op === 'not.in') {
      builder.not(filter.column, 'in', filter.value)
    } else {
      const method = filter.op as 'eq' | 'neq' | 'in' | 'is' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'like'
      ;(builder[method] as (column: string, value: unknown) => QueryBuilder)(filter.column, filter.value)
    }
  }
  for (const order of spec.orders ?? []) {
    builder.order(order.column, { ascending: order.ascending })
  }
  if (spec.limit != null) builder.limit(spec.limit)
  if (spec.offset != null) builder.range(spec.offset, spec.offset + (spec.limit ?? 1) - 1)
  if (spec.mutation?.type === 'insert') builder.insert(spec.mutation.payload)
  if (spec.mutation?.type === 'update') builder.update(spec.mutation.payload)
  if (spec.mutation?.type === 'upsert') builder.upsert(spec.mutation.payload, { onConflict: spec.mutation.onConflict })
  if (spec.mutation?.type === 'delete') builder.delete()
  if (spec.single === 'one') return builder.single()
  if (spec.single === 'maybe') return builder.maybeSingle()
  return builder
}
