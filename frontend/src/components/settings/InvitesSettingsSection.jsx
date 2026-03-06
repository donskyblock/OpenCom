export function InvitesSettingsSection({
  joinInviteCode,
  setJoinInviteCode,
  previewInvite,
  joinInvite,
  invitePendingCode,
  invitePreview,
  inviteServerId,
  setInviteServerId,
  servers,
  inviteCustomCode,
  setInviteCustomCode,
  boostStatus,
  showBoostUpsell,
  invitePermanent,
  setInvitePermanent,
  createInvite,
  inviteCode,
  inviteJoinUrl,
  buildInviteJoinUrl,
  setStatus,
}) {
  return (
    <>
      <section className="card">
        <h4>Join Server</h4>
        <input
          placeholder="Paste invite code or join link"
          value={joinInviteCode}
          onChange={(event) => setJoinInviteCode(event.target.value)}
        />
        <div className="row-actions">
          <button className="ghost" onClick={previewInvite}>
            Preview
          </button>
          <button onClick={() => joinInvite(invitePendingCode || joinInviteCode)}>
            Accept Invite
          </button>
        </div>
        {invitePreview && (
          <p className="hint">
            Invite: {invitePreview.code} · Server:{" "}
            {invitePreview.serverName || invitePreview.server_id} · Uses:{" "}
            {invitePreview.uses}
          </p>
        )}
      </section>

      <section className="card">
        <h4>Create Invite</h4>
        <p className="hint">
          Boost perk: custom code + permanent invite links (example:{" "}
          <code>/join/Open</code>).
        </p>
        <select
          value={inviteServerId}
          onChange={(event) => setInviteServerId(event.target.value)}
        >
          <option value="">Select server</option>
          {servers.map((server) => (
            <option key={server.id} value={server.id}>
              {server.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Custom code (Boost perk, optional)"
          value={inviteCustomCode}
          onChange={(event) => setInviteCustomCode(event.target.value)}
          onFocus={() => {
            if (boostStatus && !boostStatus.active) {
              showBoostUpsell("Custom invite codes require OpenCom Boost.");
            }
          }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={invitePermanent}
            onChange={(event) => {
              if (event.target.checked && boostStatus && !boostStatus.active) {
                showBoostUpsell("Permanent invite links require OpenCom Boost.");
                return;
              }
              setInvitePermanent(event.target.checked);
            }}
          />
          Permanent invite (Boost perk)
        </label>
        <button onClick={createInvite}>Generate Invite</button>
        {inviteCode && (
          <>
            <p className="hint">
              Code: <code>{inviteCode}</code>
            </p>
            <p className="hint">Invite link (share this):</p>
            <div className="invite-link-row">
              <input
                readOnly
                className="invite-link-input"
                value={inviteJoinUrl || buildInviteJoinUrl(inviteCode)}
              />
              <button
                type="button"
                onClick={() => {
                  const url = inviteJoinUrl || buildInviteJoinUrl(inviteCode);
                  navigator.clipboard
                    .writeText(url)
                    .then(() => setStatus("Invite link copied."))
                    .catch(() => setStatus("Could not copy."));
                }}
              >
                Copy link
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
