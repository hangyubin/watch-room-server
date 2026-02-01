import rateLimit from 'express-rate-limit';

// 速率限制中间件
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每IP限制100个请求
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: '请求过于频繁，请稍后再试',
    status: 429
  }
});

// 错误处理中间件
export const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  console.error('[ERROR]', err);
  
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    error: message,
    status: statusCode,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// 404处理中间件
export const notFoundHandler = (req: any, res: any) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.path
  });
};