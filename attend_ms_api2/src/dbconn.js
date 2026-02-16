// dbconn.js
import pkg from "pg"; // ES module import
const { Pool } = pkg;
let pool;

export const initDb = () => {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    console.log("DB Host:", process.env.DB_HOST);
  }
  return pool;
};

export const query = (queryText, params, callback) => {
  const poolInstance = initDb();
  // If callback is provided, use callback style
  // If no callback, return promise (for await usage)
  if (callback) {
    return poolInstance.query(queryText, params, callback);
  } else {
    return poolInstance.query(queryText, params);
  }
};
