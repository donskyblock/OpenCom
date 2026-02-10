import { createClient } from "redis";

export function makeRedis(url: string) {
  const pub = createClient({ url });
  const sub = createClient({ url });

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
}
