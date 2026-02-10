import { buildHttp } from "./http.js";
import { attachNodeGateway } from "./gateway.js";
import { guildRoutes } from "./routes/guilds.js";
import { channelRoutes } from "./routes/channels.js";
import { messageRoutes } from "./routes/messages.js";
import { env } from "./env.js";

const app = buildHttp();
const gw = attachNodeGateway(app);

await guildRoutes(app);
await channelRoutes(app);
await messageRoutes(app, gw.broadcastToChannel);

app.listen({ port: env.NODE_PORT, host: "0.0.0.0" });
