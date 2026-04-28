import mysql from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __flowsyncPool: mysql.Pool | undefined;
}

export function getPool(): mysql.Pool {
  if (!global.__flowsyncPool) {
    global.__flowsyncPool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "flowsync",
      waitForConnections: true,
      connectionLimit: 10,
      decimalNumbers: true,
      dateStrings: false,
    });
  }
  return global.__flowsyncPool;
}

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function exec(
  sql: string,
  params: unknown[] = []
): Promise<mysql.ResultSetHeader> {
  const [res] = await getPool().query(sql, params);
  return res as mysql.ResultSetHeader;
}

export async function withTx<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
