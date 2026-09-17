const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const client = require('prom-client');

const app = express();
const register = new client.Registry();
client.collectDefaultMetrics({ register });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'api-gateway' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Single public entry point -> internal cluster-DNS service names.
// This is the only service that needs to be internet-facing (behind an
// AWS ALB / Ingress); every other service stays ClusterIP-only.
const routes = {
  '/auth': process.env.AUTH_SERVICE_URL || 'http://auth-service:4001',
  '/products': process.env.PRODUCT_SERVICE_URL || 'http://product-service:4002',
  '/cart': process.env.CART_SERVICE_URL || 'http://cart-service:4003',
  '/orders': process.env.ORDER_SERVICE_URL || 'http://order-service:4004',
  '/notifications': process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:4005',
};

for (const [path, target] of Object.entries(routes)) {
  app.use(path, createProxyMiddleware({ target, changeOrigin: true, pathRewrite: { [`^${path}`]: '' } }));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`api-gateway listening on ${PORT}`));
