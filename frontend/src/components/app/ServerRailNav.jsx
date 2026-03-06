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
  return (
    <aside className="server-rail">
      <div className="rail-header" title="OpenCom">
        <img
          src="logo.png"
          alt="OpenCom"
          className="logo-img"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
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
      <button
        className={`server-pill nav-pill ${navMode === "friends" ? "active" : ""}`}
        onClick={() => setNavMode("friends")}
        title="Friends"
      >
        👥
      </button>
      <button
        className={`server-pill nav-pill ${navMode === "dms" ? "active" : ""}`}
        onClick={() => setNavMode("dms")}
        title="Direct messages"
      >
        💬
      </button>
      <button
        className={`server-pill nav-pill ${navMode === "profile" ? "active" : ""}`}
        onClick={() => setNavMode("profile")}
        title="Profile"
      >
        🪪
      </button>
      <div className="server-list">
        {servers.map((server) => (
          <button
            key={server.id}
            className={`server-pill ${server.id === activeServerId && navMode === "servers" ? "active" : ""}`}
            title={server.name}
            onClick={() => {
              setNavMode("servers");
              setActiveServerId(server.id);
              setActiveGuildId("");
              setGuildState(null);
              setMessages([]);
            }}
            onContextMenu={(event) => openServerContextMenu(event, server)}
          >
            {server.logoUrl ? (
              <img
                src={profileImageUrl(server.logoUrl)}
                alt={server.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "inherit",
                }}
              />
            ) : (
              getInitials(server.name)
            )}
            {(serverPingCounts[server.id] || 0) > 0 && (
              <span className="server-pill-ping-badge">
                {serverPingCounts[server.id]}
              </span>
            )}
          </button>
        ))}
        <button
          className="server-pill"
          title="Create or join a server"
          onClick={() => setAddServerModalOpen(true)}
        >
          ＋
        </button>
      </div>
    </aside>
  );
}
