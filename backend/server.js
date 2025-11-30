const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const initializeDatabase = require('./config/dbInit');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust for production
  },
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workers', require('./routes/workers'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/chat', require('./routes/chat'));

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

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 5000;
// Prefer an explicitly provided HOST via env var, otherwise bind to the requested
// static IP `192.168.138.251`. Setting HOST to `0.0.0.0` will keep previous
// behavior (listen on all interfaces).
const HOST = process.env.HOST || '192.168.138.251'; // default to requested IP

initializeDatabase()
  .then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`🚀 Server running on ${HOST}:${PORT}`);
      // If HOST is 0.0.0.0 we can't reliably know the external IP here —
      // print instruction instead. Otherwise show the exact URL.
      if (HOST === '0.0.0.0') {
        console.log(`📱 Server bound to all interfaces. Use your machine's IP and port ${PORT}`);
      } else {
        console.log(`📱 Accessible at http://${HOST}:${PORT}`);
      }
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

module.exports = { app, server };