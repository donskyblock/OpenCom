import { buildHttp } from "./http.js";
import { authRoutes } from "./routes/auth.js";
import { deviceRoutes } from "./routes/devices.js";
import { dmRoutes } from "./routes/dms.js";
import { serverRoutes } from "./routes/servers.js";
import { jwksRoutes } from "./routes/jwks.js";
import { attachCoreGateway } from "./gateway.js";
import { env } from "./env.js";

const app = buildHttp();
const gw = attachCoreGateway(app);

await authRoutes(app);
await deviceRoutes(app);
await serverRoutes(app);
await jwksRoutes(app);
await dmRoutes(app, gw.broadcastDM);

app.listen({ port: env.CORE_PORT, host: "0.0.0.0" });
