import { useEffect, useState } from "react";

export function ServerRailNav({
  dmNotification,
  dms,
  setNavMode,
  setActiveDmId,
  setDmNotification,
  profileImageUrl,
  getInitials,
  navMode,
  servers,
  activeServerId,
  setActiveServerId,
  setActiveGuildId,
  setGuildState,
  setMessages,
  openServerContextMenu,
  serverPingCounts,
  setAddServerModalOpen,
}) {
  const [serverIconStateById, setServerIconStateById] = useState({});

  useEffect(() => {
    setServerIconStateById((current) => {
      const next = {};
      for (const server of servers) {
        if (!server.logoUrl) continue;
        const src = profileImageUrl(server.logoUrl);
        if (!src) continue;
        const existing = current[server.id];
        if (existing?.src === src) next[server.id] = existing;
      }
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(next);
      if (
        currentKeys.length === nextKeys.length &&
        nextKeys.every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [profileImageUrl, servers]);

  function updateServerIconState(serverId, src, status) {
    setServerIconStateById((current) => {
      const existing = current[serverId];
      if (existing?.src === src && existing?.status === status) return current;
      return {
        ...current,
        [serverId]: { src, status },
      };
    });
  }

  function getServerIconState(server) {
    if (!server.logoUrl) return { src: "", state: "none" };
    const src = profileImageUrl(server.logoUrl);
    if (!src) return { src: "", state: "none" };
    const tracked = serverIconStateById[server.id];
    if (!tracked || tracked.src !== src) return { src, state: "loading" };
    return { src, state: tracked.status || "loading" };
  }

  function formatPingCount(count) {
    const normalized = Number(count || 0);
    if (!Number.isFinite(normalized) || normalized <= 0) return "";
    return normalized > 99 ? "99+" : String(normalized);
  }

  return (
    <aside className="server-rail">
      <button
        type="button"
        className={`rail-header ${navMode !== "servers" ? "active" : ""}`}
        title="OpenCom Home"
        aria-current={navMode !== "servers" ? "page" : undefined}
        onClick={() => setNavMode("friends")}
      >
        <img
          src="logo.png"
          alt="OpenCom"
          className="logo-img"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </button>
      {dmNotification &&
        (() => {
          const notifDm = dms.find((dm) => dm.id === dmNotification.dmId);
          return notifDm ? (
            <button
              type="button"
              className="dm-notification-popup"
              onClick={() => {
                setNavMode("dms");
                setActiveDmId(dmNotification.dmId);
                setDmNotification(null);
              }}
            >
              {notifDm.pfp_url ? (
                <img
                  src={profileImageUrl(notifDm.pfp_url)}
                  alt=""
                  className="dm-notification-avatar"
                />
              ) : (
                <div className="dm-notification-avatar dm-notification-avatar-initials">
                  {getInitials(notifDm.name || notifDm.username || "?")}
                </div>
              )}
              <span className="dm-notification-text">
                New message from {notifDm.name || notifDm.username || "Someone"}
              </span>
            </button>
          ) : null;
        })()}
      <div className="server-list">
        {servers.map((server) => {
          const isActive =
            server.id === activeServerId && navMode === "servers";
          const { src: iconSrc, state: iconState } = getServerIconState(server);
          const pingCount = formatPingCount(serverPingCounts[server.id]);
          return (
            <button
              key={server.id}
              type="button"
              className={`server-pill ${isActive ? "active" : ""} ${
                iconSrc ? "has-art" : "has-fallback"
              }`}
              title={server.name}
              aria-label={server.name}
              aria-current={isActive ? "page" : undefined}
              data-state={isActive ? "active" : "idle"}
              data-image-state={iconState}
              data-has-ping={pingCount ? "true" : "false"}
              onClick={() => {
                setNavMode("servers");
                setActiveServerId(server.id);
                setActiveGuildId("");
                setGuildState(null);
                setMessages([]);
              }}
              onContextMenu={(event) => openServerContextMenu(event, server)}
            >
              <span className="server-pill-surface" aria-hidden="true">
                <span className="server-pill-fallback">
                  {getInitials(server.name)}
                </span>
                {iconSrc && iconState !== "error" ? (
                  <img
                    src={iconSrc}
                    alt=""
                    loading="lazy"
                    draggable="false"
                    className={`server-pill-image ${
                      iconState === "ready" ? "is-visible" : ""
                    }`}
                    onLoad={() =>
                      updateServerIconState(server.id, iconSrc, "ready")
                    }
                    onError={() =>
                      updateServerIconState(server.id, iconSrc, "error")
                    }
                  />
                ) : null}
              </span>
              {pingCount && (
                <span
                  className="server-pill-ping-badge"
                  aria-label={`${serverPingCounts[server.id]} unread items`}
                >
                  {pingCount}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="server-pill"
          title="Create or join a server"
          onClick={() => setAddServerModalOpen(true)}
          data-state="idle"
        >
          ＋
        </button>
      </div>
    </aside>
  );
}
