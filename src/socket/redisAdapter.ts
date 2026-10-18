import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { logger } from '../observability/logger';

// Based on the official socket.io Redis adapter example:
// https://socket.io/docs/v4/redis-adapter/
let pubClient: ReturnType<typeof createClient> | null = null;
let subClient: ReturnType<typeof createClient> | null = null;

export const attachRedisAdapter = async (io: SocketIOServer, url: string) => {
  pubClient = createClient({ url });
  subClient = pubClient.duplicate();

  pubClient.on('error', (err) => logger.error({ err }, 'Redis pub client error'));
  subClient.on('error', (err) => logger.error({ err }, 'Redis sub client error'));

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  logger.info('socket.io Redis adapter attached');
};

export const closeRedisAdapter = async () => {
  await Promise.all([pubClient?.quit(), subClient?.quit()]);
};
