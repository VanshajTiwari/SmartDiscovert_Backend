require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./src/config/db');
const { initRedis } = require('./src/config/redis');
const { initSocketHandler, getConnectedDevices } = require('./src/websocket/socketHandler');
const { notFoundHandler, errorHandler } = require('./src/middlewares/errorHandler');

// Route imports
const deviceRoutes = require('./src/routes/deviceRoutes');
const configRoutes = require('./src/routes/configRoutes');
const sessionRoutes = require('./src/routes/sessionRoutes');
const commandRoutes = require('./src/routes/commandRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');
const sessionController = require('./src/controllers/sessionController');
const { requireDeviceOrAdminAuth } = require('./src/middlewares/authMiddleware');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 10000
});

// Middleware stack
app.use(helmet({
  contentSecurityPolicy: false // Allow dashboard embedding if needed
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Health check endpoint
const getHealthStatus = () => ({
  status: 'UP',
  uptime: process.uptime(),
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  connectedDevices: getConnectedDevices()
});

app.get('/health', (req, res) => res.status(200).json(getHealthStatus()));
app.get('/api/v1/health', (req, res) => res.status(200).json(getHealthStatus()));

// Mount API routes
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/config', configRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/commands', commandRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Dedicated route matching Section 4 specification: POST /api/v1/events/batch
app.post('/api/v1/events/batch', requireDeviceOrAdminAuth, sessionController.recordBatchEvents);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize WebSockets
initSocketHandler(io);

// Start server function
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  initRedis();

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`  HingeBot Backend Server Running`);
    console.log(`  Port:        ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  REST API:    http://localhost:${PORT}/api/v1`);
    console.log(`  Health:      http://localhost:${PORT}/health`);
    console.log(`===============================================`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\n[Process] Received ${signal}. Gracefully shutting down...`);
  server.close(() => {
    console.log('[HTTP] Server closed.');
    const mongoose = require('mongoose');
    mongoose.connection.close(false, () => {
      console.log('[MongoDB] Connection closed.');
      process.exit(0);
    });
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, server, io };
