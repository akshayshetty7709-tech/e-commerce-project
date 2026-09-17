const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const client_prom = require('prom-client');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const register = new client_prom.Registry();
client_prom.collectDefaultMetrics({ register });

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// This is the realtime layer of the platform: browsers open a WebSocket
// connection here, join a room named after their userId, and the service
// relays events it receives from Redis pub/sub (published by order-service,
// and potentially any other service) straight to that user's open tab -
// e.g. "your order shipped" pops up with no page refresh.
io.on('connection', (socket) => {
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
  });
});

const subscriber = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
subscriber.on('error', (err) => console.error('Redis subscriber error', err));

async function start() {
  await subscriber.connect();
  await subscriber.subscribe('order-events', (message) => {
    const event = JSON.parse(message);
    if (event.type === 'order.created') {
      io.to(`user:${event.order.user_id}`).emit('notification', {
        title: 'Order placed',
        message: `Your order #${event.order.id} has been placed successfully.`,
        order: event.order,
      });
    }
  });

  const PORT = process.env.PORT || 4005;
  server.listen(PORT, () => console.log(`notification-service listening on ${PORT}`));
}

start().catch(err => {
  console.error('Startup failed', err);
  process.exit(1);
});
