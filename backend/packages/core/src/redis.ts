type MessageHandler = (raw: string) => void;

export type RedisLike = {
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

export function makeLocalRedis(): RedisLike {
  const subscriptions = new Map<string, Set<MessageHandler>>();

  const ensureHandlers = (channel: string) => {
    let handlers = subscriptions.get(channel);
    if (!handlers) {
      handlers = new Set<MessageHandler>();
      subscriptions.set(channel, handlers);
    }
    return handlers;
  };

  return {
    pub: {
      async connect() {
        return undefined;
      },
      async quit() {
        return undefined;
      },
      async publish(channel: string, payload: string) {
        const handlers = subscriptions.get(channel);
        if (!handlers || handlers.size === 0) return 0;
        for (const handler of handlers) {
          try {
            handler(payload);
          } catch {}
        }
        return handlers.size;
      }
    },
    sub: {
      async connect() {
        return undefined;
      },
      async quit() {
        subscriptions.clear();
        return undefined;
      },
      async subscribe(channel: string, handler: MessageHandler) {
        ensureHandlers(channel).add(handler);
      }
    },
    async start() {
      return undefined;
    },
    async stop() {
      subscriptions.clear();
      return undefined;
    }
  };
}

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
