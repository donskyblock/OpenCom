export function BoostUpsellModal({
  boostUpsell,
  setBoostUpsell,
  openBoostSettingsFromUpsell,
}) {
  if (!boostUpsell) return null;

  return (
    <div className="settings-overlay" onClick={() => setBoostUpsell(null)}>
      <div
        className="add-server-modal boost-upsell-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{boostUpsell.title}</h3>
        <p className="hint">{boostUpsell.reason}</p>
        <div className="row-actions boost-actions">
          <button onClick={openBoostSettingsFromUpsell}>{boostUpsell.cta}</button>
          <button className="ghost" onClick={() => setBoostUpsell(null)}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

export function BoostGiftPromptModal({
  boostGiftPrompt,
  setBoostGiftPrompt,
  boostGiftRedeeming,
  redeemBoostGift,
}) {
  if (!boostGiftPrompt) return null;

  return (
    <div className="settings-overlay" onClick={() => setBoostGiftPrompt(null)}>
      <div
        className="add-server-modal boost-upsell-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Redeem Boost Gift?</h3>
        <p className="hint">
          <strong>{boostGiftPrompt.from?.username || "Someone"}</strong> sent you{" "}
          {boostGiftPrompt.grantDays || 30} days of Boost.
        </p>
        <p className="hint">
          This gift expires on{" "}
          {boostGiftPrompt.expiresAt
            ? new Date(boostGiftPrompt.expiresAt).toLocaleDateString()
            : "soon"}
          .
        </p>
        <div className="row-actions boost-actions">
          <button
            onClick={() => redeemBoostGift(boostGiftPrompt.code)}
            disabled={boostGiftRedeeming}
          >
            {boostGiftRedeeming ? "Redeeming…" : "Accept Gift"}
          </button>
          <button className="ghost" onClick={() => setBoostGiftPrompt(null)}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
