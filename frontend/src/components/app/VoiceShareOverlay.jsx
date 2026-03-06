export function VoiceShareOverlay({
  isInVoiceChannel,
  navMode,
  screenShareOverlayOpen,
  selectedRemoteScreenShare,
  remoteScreenShares,
  selectScreenShare,
  memberNameById,
  setScreenShareOverlayOpen,
}) {
  if (
    !isInVoiceChannel ||
    (navMode !== "servers" && navMode !== "dms") ||
    !screenShareOverlayOpen ||
    !selectedRemoteScreenShare
  ) {
    return null;
  }

  return (
    <div className="voice-share-overlay" onClick={(event) => event.stopPropagation()}>
      <div className="voice-share-overlay-head">
        <strong>Screen Share</strong>
        <div className="voice-share-overlay-actions">
          {remoteScreenShares.length > 1 && (
            <select
              value={selectedRemoteScreenShare.producerId}
              onChange={(event) => selectScreenShare(event.target.value)}
            >
              {remoteScreenShares.map((share) => (
                <option key={share.producerId} value={share.producerId}>
                  {memberNameById.get(share.userId) ||
                    share.userId ||
                    "Screen Share"}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="ghost"
            onClick={() => setScreenShareOverlayOpen(false)}
          >
            Hide
          </button>
        </div>
      </div>
      <video
        autoPlay
        playsInline
        className="voice-share-overlay-video"
        ref={(node) => {
          if (!node || !selectedRemoteScreenShare.stream) return;
          if (node.srcObject !== selectedRemoteScreenShare.stream)
            node.srcObject = selectedRemoteScreenShare.stream;
        }}
      />
      <span className="voice-share-overlay-name">
        {memberNameById.get(selectedRemoteScreenShare.userId) ||
          selectedRemoteScreenShare.userId ||
          "Screen Share"}
      </span>
    </div>
  );
}
