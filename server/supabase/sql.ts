// Only application-owned SQL reaches this adapter; values stay bound parameters.
export function postgresQuery(source: string) {
  let index = 0;
  let sql = source.replace(/'([^']|'')*'|\buser\b|\?|\bAS (isKeeper|hasPassword)\b/g, token => {
    if (token.startsWith("'")) return token;
    if (token === '?') return `$${++index}`;
    if (token === 'user') return '"user"';
    return `AS "${token.slice(3)}"`;
  });
  sql = sql.replace(/\bkeeper IS (\$\d+)/g, 'keeper IS NOT DISTINCT FROM $1');
  if (sql.includes('INSERT OR IGNORE')) sql = sql.replace('INSERT OR IGNORE', 'INSERT') + ' ON CONFLICT DO NOTHING';
  if (sql.startsWith('INSERT INTO identity_attempts')) {
    sql = sql.replace(/WHEN started</g, 'WHEN identity_attempts.started<').replace('ELSE count+1', 'ELSE identity_attempts.count+1').replace('ELSE started END', 'ELSE identity_attempts.started END');
  }
  return sql;
}

export function database(client: any) {
  class Statement {
    values: any[] = [];
    source: string;
    constructor(source: string) { this.source = source; }
    bind(...values: any[]) { this.values = values; return this; }
    async execute() { return await client.unsafe(postgresQuery(this.source), this.values); }
    async first<T = any>(): Promise<T | null> { return (await this.execute())[0] ?? null; }
    async all() { return { results: [...await this.execute()] }; }
    async run() { const rows = await this.execute(); return { results: [...rows], meta: { changes: rows.count } }; }
  }
  return {
    prepare(source: string) { return new Statement(source); },
    // The request already runs inside a Postgres transaction.
    async batch(statements: Statement[]) { const result = []; for (const s of statements) result.push(await s.run()); return result; },
  };
}
