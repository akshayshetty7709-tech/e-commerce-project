const express = require('express');
const axios = require('axios');
const { createClient } = require('redis');
const client_prom = require('prom-client');
const { pool, init } = require('./db');

const app = express();
app.use(express.json());

const register = new client_prom.Registry();
client_prom.collectDefaultMetrics({ register });

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:4002';

// Redis is reused here (separate from cart) as a lightweight pub/sub bus so
// order-service can publish "order.created" events without a heavyweight
// message broker, and notification-service can subscribe for realtime push.
const publisher = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
publisher.on('error', (err) => console.error('Redis publisher error', err));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'order-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.post('/orders', async (req, res) => {
  const { userId, productId, quantity } = req.body;
  if (!userId || !productId || !quantity) {
    return res.status(400).json({ error: 'userId, productId, quantity required' });
  }
  try {
    // Reserve stock in product-service first (fails fast if not enough stock)
    await axios.post(`${PRODUCT_SERVICE_URL}/products/${productId}/reserve`, { quantity });

    const result = await pool.query(
      'INSERT INTO orders (user_id, product_id, quantity, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [userId, productId, quantity, 'PLACED']
    );
    const order = result.rows[0];

    // Publish realtime event so notification-service can push to the user's socket
    await publisher.publish('order-events', JSON.stringify({
      type: 'order.created',
      order,
    }));

    res.status(201).json(order);
  } catch (err) {
    if (err.response && err.response.status === 409) {
      return res.status(409).json({ error: 'insufficient stock' });
    }
    console.error(err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

app.get('/orders/:userId', async (req, res) => {
  const result = await pool.query('SELECT * FROM orders WHERE user_id=$1 ORDER BY created_at DESC', [req.params.userId]);
  res.json(result.rows);
});

const PORT = process.env.PORT || 4004;
Promise.all([init(), publisher.connect()]).then(() => {
  app.listen(PORT, () => console.log(`order-service listening on ${PORT}`));
}).catch(err => {
  console.error('Startup failed', err);
  process.exit(1);
});
