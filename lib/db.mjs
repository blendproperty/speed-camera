import { readFile } from 'node:fs/promises';
import pg from 'pg';

let pool;
let initialization;

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  return pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 6,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000
  });
}

export function initialize() {
  initialization ??= (async () => {
    const schema = await readFile('db/schema.sql', 'utf8');
    await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(276778818)');
      await client.query(schema);
    });
  })().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export async function transaction(work) {
  const client = await database().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function audit(client, actor, action, target, detail = {}) {
  await client.query(
    'INSERT INTO audit(actor, action, target, detail) VALUES ($1,$2,$3,$4)',
    [actor, action, target, JSON.stringify(detail)]
  );
}
