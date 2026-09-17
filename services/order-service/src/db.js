const { Pool } = require('pg');

// PostgreSQL is used for orders because an order is a financial/transactional
// record: it must be durable, support multi-row transactions (order + order
// items), and be queryable with strong consistency for reporting, refunds,
// and audits - exactly what an RDBMS is built for.
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'orderdb',
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      product_id VARCHAR(255) NOT NULL,
      quantity INT NOT NULL,
      status VARCHAR(50) DEFAULT 'PLACED',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

module.exports = { pool, init };
