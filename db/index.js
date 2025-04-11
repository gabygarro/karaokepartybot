import { createPool } from 'mariadb';
import { connect as dbConnect, end as dbEnd } from '../db/index.js';

export const connect = async () => {
  const password = process.env.DB_PWD;
  if (!password) throw new Error('Missing db credentials');
  const pool = createPool({
    host: 'localhost',
    user: 'bot',
    password,
    database: 'karaokebot',
    connectionLimit: 6,
    trace: true,
  });
  const conn = await pool.getConnection();
  return conn;
};

export const end = (conn) => {
  if (conn) {
    conn.end();
  }
  return;
};
