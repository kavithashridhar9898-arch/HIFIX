const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');
const initializeDatabase = require('./config/dbInit');
const errorHandler        = require('./middleware/errorHandler');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Optimize HTTP Keep-Alive timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production
  },
});

// 1. Enable Gzip / Brotli response compression
app.use(compression({
  level: 6,
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// 2. Serve static files with intelligent browser caching headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (/\.(png|jpe?g|webp|gif|svg|pdf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// 3. CORS & Body Parsers
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request logging pipeline (optimized for production throughput)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/worker-profile', require('./routes/workerProfile'));
app.use('/api/work-timer', require('./routes/workTimer'));
app.use('/api/invoice', require('./routes/invoiceRequests'));
app.use('/api/blockchain', require('./routes/blockchain'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('✅ A user connected to sockets');

  // User personal room join (for direct events)
  socket.on('join', (userId) => {
    if (!userId) return;
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room user_${userId}`);
  });

  // Allow joining a specific conversation room for live typing / message stream
  socket.on('conversation:join', (conversationId) => {
    if (!conversationId) return;
    socket.join(`conversation_${conversationId}`);
    console.log(`Socket joined conversation_${conversationId}`);
  });

  // Relay typing indicator within conversation room
  socket.on('conversation:typing', ({ conversationId, userId, isTyping }) => {
    if (!conversationId || !userId) return;
    socket.to(`conversation_${conversationId}`).emit('typing_status', { conversationId, userId, isTyping });
  });

  // Basic real-time message broadcast (backend REST already emits to user rooms) - this supports clients emitting directly
  socket.on('conversation:message', ({ conversationId, message }) => {
    if (!conversationId || !message) return;
    socket.to(`conversation_${conversationId}`).emit('new_message', { conversationId, message });
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected from sockets');
  });
});

// Make io accessible to other modules
app.set('io', io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'HIFIX API is running',
  });
});

// Centralized error handling — must be last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

const BlockchainQueue = require('./services/BlockchainQueue');

initializeDatabase()
  .then(async () => {
    // Initialize durable blockchain queue server restart recovery
    await BlockchainQueue.initServerRecovery();

    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      console.log(`📱 Accessible at http://192.168.189.251:${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

module.exports = { app, server };