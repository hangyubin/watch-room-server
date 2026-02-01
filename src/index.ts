import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { WatchRoomServer } from './watch-room-server.js';
import config, { validateConfig } from './config/index.js';
import { apiLimiter, errorHandler, notFoundHandler } from './middleware/index.js';

const app = express();
const httpServer = createServer(app);

// 验证配置
validateConfig();

const { PORT, AUTH_KEY, ALLOWED_ORIGINS, NODE_ENV } = config;

// 中间件
app.use(compression());
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...ALLOWED_ORIGINS.map(origin => origin)],
    }
  }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use('/api/', apiLimiter);
app.use('/stats', apiLimiter);

// 健康检查端点
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 统计信息端点（需要认证）
app.get('/stats', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${AUTH_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stats = watchRoomServer.getStats();
  return res.json(stats);
});

// 根路径
app.get('/', (_req, res) => {
  res.json({
    name: 'Watch Room Server',
    version: '1.0.0',
    description: 'Standalone watch room server for MoonTVPlus',
    endpoints: {
      health: '/health',
      stats: '/stats (requires auth)',
      socket: '/socket.io',
    },
  });
});

// 404 处理
app.use(notFoundHandler);

// 全局错误处理中间件
app.use(errorHandler);

// Socket.IO 配置
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  maxHttpBufferSize: 1e6, // 1MB 消息大小限制
  pingTimeout: 45000,
  pingInterval: 20000,
});

// 初始化观影室服务器
const watchRoomServer = new WatchRoomServer(io, AUTH_KEY);

// 启动服务器
httpServer.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🎬 Watch Room Server Started');
  console.log('='.repeat(60));
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`Port: ${PORT}`);
  console.log(`Auth Key (first 8 chars): ${AUTH_KEY.substring(0, 8)}...`);
  console.log(`Auth Key (last 8 chars): ...${AUTH_KEY.substring(AUTH_KEY.length - 8)}`);
  console.log(`Auth Key Length: ${AUTH_KEY.length}`);
  console.log(`Allowed Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('='.repeat(60));
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log(`Stats: http://localhost:${PORT}/stats`);
  console.log(`Socket.IO: ws://localhost:${PORT}/socket.io`);
  console.log('='.repeat(60));
});

// 优雅关闭
const shutdown = (signal: string) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  watchRoomServer.destroy();

  httpServer.close(() => {
    console.log('[WatchRoom] HTTP server closed');
    process.exit(0);
  });

  // 强制退出超时
  setTimeout(() => {
    console.error('[WatchRoom] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// 未捕获的异常处理
process.on('uncaughtException', (error) => {
  console.error('[WatchRoom] Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WatchRoom] Unhandled Rejection at:', promise, 'reason:', reason);
});
