const express = require('express');
const client = require('prom-client');
const { connect, Product } = require('./db');

const app = express();
app.use(express.json());

const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/products', async (req, res) => {
  const products = await Product.find().limit(100);
  res.json(products);
});

app.get('/products/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'not found' });
  res.json(product);
});

app.post('/products', async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json(product);
});

// Called by order-service to decrement stock atomically when an order is placed
app.post('/products/:id/reserve', async (req, res) => {
  const { quantity } = req.body;
  const product = await Product.findOneAndUpdate(
    { _id: req.params.id, stock: { $gte: quantity } },
    { $inc: { stock: -quantity } },
    { new: true }
  );
  if (!product) return res.status(409).json({ error: 'insufficient stock' });
  res.json(product);
});

const PORT = process.env.PORT || 4002;
connect().then(() => {
  app.listen(PORT, () => console.log(`product-service listening on ${PORT}`));
}).catch(err => {
  console.error('DB connect failed', err);
  process.exit(1);
});
