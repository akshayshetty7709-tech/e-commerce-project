const express = require('express');
const client_prom = require('prom-client');
const { client, connect } = require('./redisClient');

const app = express();
app.use(express.json());

const register = new client_prom.Registry();
client_prom.collectDefaultMetrics({ register });

const CART_TTL_SECONDS = 60 * 60 * 24 * 3; // cart expires after 3 days idle

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'cart-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/cart/:userId', async (req, res) => {
  const data = await client.get(`cart:${req.params.userId}`);
  res.json(data ? JSON.parse(data) : { items: [] });
});

app.post('/cart/:userId/items', async (req, res) => {
  const key = `cart:${req.params.userId}`;
  const existing = await client.get(key);
  const cart = existing ? JSON.parse(existing) : { items: [] };
  cart.items.push(req.body);
  await client.set(key, JSON.stringify(cart), { EX: CART_TTL_SECONDS });
  res.status(201).json(cart);
});

app.delete('/cart/:userId', async (req, res) => {
  await client.del(`cart:${req.params.userId}`);
  res.status(204).send();
});

const PORT = process.env.PORT || 4003;
connect().then(() => {
  app.listen(PORT, () => console.log(`cart-service listening on ${PORT}`));
}).catch(err => {
  console.error('Redis connect failed', err);
  process.exit(1);
});
