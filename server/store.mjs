// Adaptador isolado: memória local (volátil) ou PostgreSQL no Render (durável).
// Não salvar partidas oficiais em arquivo JSON na pasta do serviço: o Render
// utiliza sistema de arquivos efêmero por padrão.
export async function createStore(databaseUrl) {
  if(!databaseUrl) {
    const matches = new Map();
    return {
      provider:'memory',
      async create(state) {matches.set(state.id,structuredClone(state));},
      async get(id) {return matches.has(id)?structuredClone(matches.get(id)):null;},
      async change(id,fn) {
        const old=matches.get(id);
        if(!old)return null;
        const next=structuredClone(old);
        const result=fn(next);
        if(result instanceof Promise)throw Error('Transações locais precisam ser síncronas.');
        next.revision++;
        matches.set(id,next);
        return structuredClone(next);
      },
      async close(){}
    };
  }
  const pg = await import('pg');
  const Pool = pg.Pool || pg.default.Pool;
  const pool = new Pool({connectionString:databaseUrl, max:5, connectionTimeoutMillis:10000});
  await pool.query(`CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  return {
    provider:'postgres',
    async create(state) {
      await pool.query('INSERT INTO matches (id,revision,state) VALUES ($1,$2,$3::jsonb)',[state.id,state.revision,JSON.stringify(state)]);
    },
    async get(id) {
      const result=await pool.query('SELECT state FROM matches WHERE id=$1',[id]);
      return result.rows[0]?.state??null;
    },
    async change(id,fn) {
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        const result=await client.query('SELECT state FROM matches WHERE id=$1 FOR UPDATE',[id]);
        const state=result.rows[0]?.state;
        if(!state){await client.query('ROLLBACK');return null;}
        const updated=fn(state);
        if(updated instanceof Promise)throw Error('Transação deve ser síncrona.');
        state.revision++;
        await client.query('UPDATE matches SET state=$2::jsonb,revision=$3 WHERE id=$1',[id,JSON.stringify(state),state.revision]);
        await client.query('COMMIT');
        return state;
      } catch(error) {await client.query('ROLLBACK');throw error;}
      finally {client.release();}
    },
    async close(){await pool.end();}
  };
}
