import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  AUTH_KEY: (process.env.AUTH_KEY || '').trim().replace(/^["']|["']$/g, ''),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
  NODE_ENV: process.env.NODE_ENV || 'development'
};

// 验证必需的环境变量
export const validateConfig = () => {
  if (!config.AUTH_KEY) {
    console.error('Error: AUTH_KEY environment variable is required');
    process.exit(1);
  }
  
  return true;
};

export default config;