import "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: any;
  }
  interface FastifyRequest {
    auth: {
      userId: string;
      serverId: string;
      roles: string[];
      token: string;
    } | null;
  }
}
