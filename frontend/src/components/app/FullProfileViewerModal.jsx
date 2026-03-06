export function FullProfileViewerModal({
  fullProfileViewer,
  setFullProfileViewer,
  profileImageUrl,
  getFullProfileFontFamily,
  getFullProfileElementFrameStyle,
  toggleFullProfileViewerMusicPlayback,
  renderFullProfileElement,
  fullProfileViewerMusicPlaying,
  fullProfileViewerHasPlayableMusic,
  fullProfileViewerMusicAudioRef,
  setFullProfileViewerMusicPlaying,
}) {
  if (!fullProfileViewer) return null;

  return (
        <div
          className="settings-overlay"
          onClick={() => setFullProfileViewer(null)}
        >
          <div
            className="full-profile-viewer-fullscreen"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="full-profile-viewer-head">
              <h3>
                {fullProfileViewer.displayName || fullProfileViewer.username}'s
                Full Profile
              </h3>
              <button
                className="danger"
                onClick={() => setFullProfileViewer(null)}
              >
                Close
              </button>
            </div>
            <div
              className="full-profile-canvas full-profile-canvas-readonly full-profile-viewer-canvas profile-studio-canvas"
              style={{
                background:
                  fullProfileViewer.fullProfile?.theme?.background ||
                  "linear-gradient(150deg, #16274b, #0f1a33 65%)",
                color: fullProfileViewer.fullProfile?.theme?.text || "#dfe9ff",
                "--full-profile-accent":
                  fullProfileViewer.fullProfile?.theme?.accent || "#9bb6ff",
                "--full-profile-font": getFullProfileFontFamily(
                  fullProfileViewer.fullProfile?.theme?.fontPreset || "sans",
                ),
              }}
            >
              <div
                className="full-profile-canvas-card"
                style={{
                  background:
                    fullProfileViewer.fullProfile?.theme?.card ||
                    "rgba(9, 14, 28, 0.62)",
                }}
              >
                {(fullProfileViewer.fullProfile?.elements || [])
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((element) => (
                    <div
                      key={element.id}
                      className={`full-profile-element full-profile-element-${element.type}`}
                      style={getFullProfileElementFrameStyle(element)}
                      onClick={(event) => {
                        if (
                          String(element.type || "").toLowerCase() !== "music"
                        )
                          return;
                        event.preventDefault();
                        event.stopPropagation();
                        toggleFullProfileViewerMusicPlayback().catch(() => {});
                      }}
                    >
                      {renderFullProfileElement(element, fullProfileViewer, {
                        musicPlaying: fullProfileViewerMusicPlaying,
                      })}
                    </div>
                  ))}
              </div>
            </div>
            {fullProfileViewerHasPlayableMusic && (
              <audio
                ref={fullProfileViewerMusicAudioRef}
                src={
                  profileImageUrl(fullProfileViewer.fullProfile.music.url) ||
                  fullProfileViewer.fullProfile.music.url
                }
                preload="metadata"
                onPlay={() => setFullProfileViewerMusicPlaying(true)}
                onPause={() => setFullProfileViewerMusicPlaying(false)}
                onEnded={() => setFullProfileViewerMusicPlaying(false)}
                style={{ display: "none" }}
              />
            )}
          </div>
        </div>
  );
}
