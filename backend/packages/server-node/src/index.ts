import { buildHttp } from "./http.js";
import { attachNodeGateway } from "./gateway.js";
import { guildRoutes } from "./routes/guilds.js";
import { channelRoutes } from "./routes/channels.js";
import { messageRoutes } from "./routes/messages.js";
import {
  env,
  mediasoupNetworkingWarnings,
  resolvedMediasoupAnnouncedAddress,
  resolvedMediasoupAnnouncedAddressKind,
  resolvedMediasoupAnnouncedAddressSource,
} from "./env.js";
import { initMediasoup } from "./voice/mediasoup.js";
import { attachmentRoutes } from "./routes/attachments.js";
import { startAttachmentCleanupLoop } from "./jobs/attachmentCleanup.js";
import { startNodeSyncLoop } from "./jobs/nodeSync.js";
import { roleRoutes } from "./routes/roles.js";
import { overwriteRoutes } from "./routes/overwrites.js";
import { memberRoutes } from "./routes/members.js";
import { registerRestAuth } from "./auth/restAuth.js";
import { guildJoinRoutes } from "./routes/guildJoin.js";
import { guildStateRoutes } from "./routes/guildState.js";
import { meRoutes } from "./routes/me.js";
import { discordCompatRoutes } from "./routes/discordCompat.js";
import { extensionRoutes } from "./routes/extensions.js";
import { restorePersistedExtensions } from "./extensions/host.js";
import { createLogger } from "./logger.js";
import { emoteRoutes } from "./routes/emotes.js";
import { privateCallChannelRoutes } from "./routes/privateCallChannels.js";

const logger = createLogger("server");

logger.info("Starting node server", {
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
  debugHttp: env.DEBUG_HTTP,
  debugVoice: env.DEBUG_VOICE,
  mediasoupAnnouncedAddress: resolvedMediasoupAnnouncedAddress || "(unset)",
  mediasoupAnnouncedAddressKind: resolvedMediasoupAnnouncedAddressKind,
  mediasoupAnnouncedAddressSource: resolvedMediasoupAnnouncedAddressSource || "(unset)",
  mediasoupEnableUdp: env.MEDIASOUP_ENABLE_UDP,
  mediasoupEnableTcp: env.MEDIASOUP_ENABLE_TCP,
  mediasoupPreferUdp: env.MEDIASOUP_PREFER_UDP,
  rtcMinPort: env.MEDIASOUP_RTC_MIN_PORT,
  rtcMaxPort: env.MEDIASOUP_RTC_MAX_PORT
});

if (!env.MEDIASOUP_ANNOUNCED_ADDRESS && !env.MEDIASOUP_ANNOUNCED_IP && resolvedMediasoupAnnouncedAddress) {
  logger.info("Using inferred mediasoup announced address from PUBLIC_BASE_URL", {
    announcedAddress: resolvedMediasoupAnnouncedAddress,
    publicBaseUrl: env.PUBLIC_BASE_URL,
  });
}

logger.info("Voice RTC networking", {
  listenIp: env.MEDIASOUP_LISTEN_IP,
  announcedAddress: resolvedMediasoupAnnouncedAddress || "(unset)",
  announcedAddressKind: resolvedMediasoupAnnouncedAddressKind,
  announcedAddressSource: resolvedMediasoupAnnouncedAddressSource || "(unset)",
  protocols: [
    ...(env.MEDIASOUP_ENABLE_UDP ? ["udp"] : []),
    ...(env.MEDIASOUP_ENABLE_TCP ? ["tcp"] : []),
  ],
  rtcPortRange: `${env.MEDIASOUP_RTC_MIN_PORT}-${env.MEDIASOUP_RTC_MAX_PORT}`,
});

if (mediasoupNetworkingWarnings.length) {
  logger.warn("Voice RTC networking warnings detected", {
    warnings: mediasoupNetworkingWarnings,
    listenIp: env.MEDIASOUP_LISTEN_IP,
    announcedAddress: resolvedMediasoupAnnouncedAddress || "(unset)",
    rtcPortRange: `${env.MEDIASOUP_RTC_MIN_PORT}-${env.MEDIASOUP_RTC_MAX_PORT}`,
    protocols: {
      udp: env.MEDIASOUP_ENABLE_UDP,
      tcp: env.MEDIASOUP_ENABLE_TCP,
      preferUdp: env.MEDIASOUP_PREFER_UDP,
    },
  });
}

await initMediasoup();
const app = buildHttp();
await registerRestAuth(app);

const gw = attachNodeGateway(app);

await guildRoutes(app);
await guildJoinRoutes(app);
await guildStateRoutes(app);
await emoteRoutes(app);

await channelRoutes(app, gw.broadcastGuild);
await messageRoutes(app, gw.broadcastToChannel, gw.broadcastMention);

await roleRoutes(app, gw.broadcastGuild);
await overwriteRoutes(app, gw.broadcastGuild);
await memberRoutes(app, gw.broadcastGuild);
await meRoutes(app);
await discordCompatRoutes(app);
await extensionRoutes(app, gw.broadcastToChannel);

await privateCallChannelRoutes(app);
await attachmentRoutes(app);
startAttachmentCleanupLoop();
startNodeSyncLoop();
await restorePersistedExtensions();

await app.listen({ port: env.NODE_PORT, host: env.NODE_HOST });
logger.info("Node server listening", { host: env.NODE_HOST, port: env.NODE_PORT });
