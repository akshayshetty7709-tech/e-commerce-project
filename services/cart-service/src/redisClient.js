const { createClient } = require('redis');

// Redis is used for the cart because a cart is short-lived, read/written on
// almost every page view, and doesn't need relational integrity - an
// in-memory key/value store gives sub-millisecond latency and native TTL
// (cart auto-expires after inactivity) which a relational DB doesn't give
// for free.
const client = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
client.on('error', (err) => console.error('Redis error', err));

async function connect() {
  await client.connect();
}

module.exports = { client, connect };
