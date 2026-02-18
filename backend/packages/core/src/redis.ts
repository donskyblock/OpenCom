type MessageHandler = (raw: string) => void;

type RedisLike = {
  pub: {
    connect: () => Promise<unknown>;
    quit: () => Promise<unknown>;
    publish: (channel: string, payload: string) => Promise<number>;
  };
  sub: {
    connect: () => Promise<unknown>;
    quit: () => Promise<unknown>;
    subscribe: (channel: string, handler: MessageHandler) => Promise<void>;
  };
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export async function makeRedis(url: string): Promise<RedisLike> {
  try {
    const redis = await import("redis");
    const pub = redis.createClient({ url });
    const sub = redis.createClient({ url });

    return {
      pub,
      sub,
      async start() {
        await pub.connect();
        await sub.connect();
      },
      async stop() {
        await pub.quit();
        await sub.quit();
      }
    };
  } catch (error) {
    throw new Error(`REDIS_INIT_FAILED: ${error instanceof Error ? error.message : "unknown redis init error"}`);
  }
}
