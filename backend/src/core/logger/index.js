import pino from 'pino';
import pinoPretty from 'pino-pretty';

const logger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
  process.env.NODE_ENV !== 'production'
    ? pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    })
    : undefined
);

export default logger;
