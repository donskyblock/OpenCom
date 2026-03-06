export function ProfileStudioPage({
  resetFullProfileDraftToBasic,
  saveFullProfileDraft,
  profileForm,
  setProfileForm,
  onAvatarUpload,
  onBannerUpload,
  saveProfile,
  addFullProfileElement,
  fullProfileDraft,
  addFullProfileTextBlock,
  hasBoostForFullProfiles,
  fullProfileEditorCanvasRef,
  profileStudioCanvasMinHeight,
  getFullProfileFontFamily,
  fullProfileDraggingElementId,
  profileStudioSelectedElementId,
  getFullProfileElementFrameStyle,
  onFullProfileElementMouseDown,
  setProfileStudioSelectedElementId,
  renderFullProfileElement,
  profileStudioPreviewProfile,
  openBoostUpsell,
  selectedProfileStudioElement,
  updateFullProfileElement,
  nudgeFullProfileElement,
  removeFullProfileElement,
  setFullProfileDraft,
  updateFullProfileLink,
  removeFullProfileLink,
  addFullProfileLink,
  onAudioFieldUpload,
}) {
  return (
          <div className="profile-studio profile-studio-full-page">
            <section className="profile-studio-layout">
              <aside className="card profile-studio-panel">
                <h3>Profile Studio</h3>
                <p className="hint">
                  Drag, resize, and style each element directly on the canvas.
                </p>
                <div className="row-actions">
                  <button
                    type="button"
                    className="ghost"
                    onClick={resetFullProfileDraftToBasic}
                  >
                    Reset
                  </button>
                  <button type="button" onClick={saveFullProfileDraft}>
                    Save Full Profile
                  </button>
                </div>
                <h4>Identity</h4>
                <label>
                  Display Name
                  <input
                    value={profileForm.displayName}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Bio
                  <textarea
                    rows={3}
                    value={profileForm.bio}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        bio: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Avatar URL
                  <input
                    value={profileForm.pfpUrl}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        pfpUrl: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Upload Avatar
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onAvatarUpload}
                  />
                </label>
                <label>
                  Banner URL
                  <input
                    value={profileForm.bannerUrl}
                    onChange={(event) =>
                      setProfileForm((current) => ({
                        ...current,
                        bannerUrl: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Upload Banner
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onBannerUpload}
                  />
                </label>
                <button type="button" onClick={saveProfile}>
                  Save Identity
                </button>

                <h4>Add Elements</h4>
                <div className="profile-studio-tool-grid">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("avatar")}
                  >
                    Avatar
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("banner")}
                  >
                    Banner
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("name")}
                  >
                    Name
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("bio")}
                  >
                    Bio
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("links")}
                  >
                    Links
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => addFullProfileElement("music")}
                    disabled={
                      !String(fullProfileDraft?.music?.url || "").trim()
                    }
                    title={
                      String(fullProfileDraft?.music?.url || "").trim()
                        ? "Add music button element"
                        : "Set Music URL first"
                    }
                  >
                    Music
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={addFullProfileTextBlock}
                  >
                    Text
                  </button>
                </div>
                {!hasBoostForFullProfiles && (
                  <p className="hint">
                    Boost is required to save custom layouts.
                  </p>
                )}
              </aside>

              <section className="card profile-studio-canvas-wrap">
                <div className="profile-studio-canvas-head">
                  <h4>Canvas</h4>
                  <p className="hint">Drag elements directly to place them.</p>
                </div>
                <div
                  ref={fullProfileEditorCanvasRef}
                  className={`full-profile-canvas profile-studio-canvas ${hasBoostForFullProfiles ? "" : "locked"}`}
                  style={{
                    background:
                      fullProfileDraft?.theme?.background ||
                      "linear-gradient(150deg, #16274b, #0f1a33 65%)",
                    color: fullProfileDraft?.theme?.text || "#dfe9ff",
                    minHeight: `${profileStudioCanvasMinHeight}px`,
                    "--full-profile-accent":
                      fullProfileDraft?.theme?.accent || "#9bb6ff",
                    "--full-profile-font": getFullProfileFontFamily(
                      fullProfileDraft?.theme?.fontPreset || "sans",
                    ),
                  }}
                >
                  <div
                    className="full-profile-canvas-card"
                    style={{
                      background:
                        fullProfileDraft?.theme?.card ||
                        "rgba(9, 14, 28, 0.62)",
                    }}
                  >
                    {(fullProfileDraft?.elements || [])
                      .slice()
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                      .map((element) => (
                        <div
                          key={element.id}
                          className={`full-profile-element full-profile-element-${element.type} ${fullProfileDraggingElementId === element.id ? "dragging" : ""} ${profileStudioSelectedElementId === element.id ? "selected" : ""}`}
                          style={getFullProfileElementFrameStyle(element)}
                          onMouseDown={(event) => {
                            if (!hasBoostForFullProfiles) return;
                            onFullProfileElementMouseDown(event, element.id);
                          }}
                          onClick={() =>
                            setProfileStudioSelectedElementId(element.id)
                          }
                        >
                          {renderFullProfileElement(
                            element,
                            profileStudioPreviewProfile,
                          )}
                        </div>
                      ))}
                  </div>
                  {!hasBoostForFullProfiles && (
                    <div className="full-profile-lock-overlay">
                      <p>Boost required for full customization.</p>
                      <button
                        type="button"
                        onClick={() =>
                          openBoostUpsell(
                            "Boost required",
                            "Custom full profiles are a Boost perk.",
                            "Open billing",
                          )
                        }
                      >
                        See Boost
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <aside className="card profile-studio-panel">
                <h4>Inspector</h4>
                <div className="full-profile-layer-list">
                  {(fullProfileDraft?.elements || [])
                    .slice()
                    .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
                    .map((element) => (
                      <button
                        key={`layer-${element.id}`}
                        type="button"
                        className={`full-profile-layer-item ${profileStudioSelectedElementId === element.id ? "active" : ""}`}
                        onClick={() =>
                          setProfileStudioSelectedElementId(element.id)
                        }
                      >
                        <span>{element.type}</span>
                        <small>
                          {Math.round(Number(element.x) || 0)}%,{" "}
                          {Math.round(Number(element.y) || 0)}%
                        </small>
                      </button>
                    ))}
                  {(!fullProfileDraft?.elements ||
                    fullProfileDraft.elements.length === 0) && (
                    <p className="hint">No elements on this canvas yet.</p>
                  )}
                </div>
                {selectedProfileStudioElement ? (
                  <>
                    <p className="hint">
                      Editing:{" "}
                      <strong>{selectedProfileStudioElement.type}</strong>
                    </p>
                    {selectedProfileStudioElement.type === "text" && (
                      <label>
                        Text
                        <input
                          value={selectedProfileStudioElement.text || ""}
                          onChange={(event) =>
                            updateFullProfileElement(
                              selectedProfileStudioElement.id,
                              { text: event.target.value },
                            )
                          }
                        />
                      </label>
                    )}
                    <label>
                      X
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(selectedProfileStudioElement.x)}
                        onChange={(event) =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            { x: event.target.value },
                          )
                        }
                      />
                    </label>
                    <label>
                      Y
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(selectedProfileStudioElement.y)}
                        onChange={(event) =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            { y: event.target.value },
                          )
                        }
                      />
                    </label>
                    <label>
                      Width
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={Math.round(selectedProfileStudioElement.w)}
                        onChange={(event) =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            { w: event.target.value },
                          )
                        }
                      />
                    </label>
                    <label>
                      Height
                      <input
                        type="range"
                        min={1}
                        max={100}
                        value={Math.round(selectedProfileStudioElement.h)}
                        onChange={(event) =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            { h: event.target.value },
                          )
                        }
                      />
                    </label>
                    <label>
                      Opacity (
                      {Math.max(
                        20,
                        Math.min(
                          100,
                          Number(selectedProfileStudioElement.opacity ?? 100),
                        ),
                      )}
                      %)
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={Math.max(
                          20,
                          Math.min(
                            100,
                            Number(selectedProfileStudioElement.opacity ?? 100),
                          ),
                        )}
                        onChange={(event) =>
                          updateFullProfileElement(
                            selectedProfileStudioElement.id,
                            { opacity: Number(event.target.value) },
                          )
                        }
                      />
                    </label>
                    <label>
                      Corner Radius (
                      {Math.max(
                        0,
                        Math.min(
                          40,
                          Number(selectedProfileStudioElement.radius ?? 8),
                        ),
                      )}
                      px)
                      <input
                        type="range"
                        min={0}
                        max={40}
                        value={Math.max(
                          0,
                          Math.min(
                            40,
                            Number(selectedProfileStudioElement.radius ?? 8),
                          ),
                        )}
                        onChange={(event) =>
                          updateFullProfileElement(
                            selectedProfileStudioElement.id,
                            { radius: Number(event.target.value) },
                          )
                        }
                      />
                    </label>
                    {["name", "bio", "links", "text", "music"].includes(
                      selectedProfileStudioElement.type,
                    ) && (
                      <>
                        <label>
                          Font Size (
                          {Math.max(
                            10,
                            Math.min(
                              72,
                              Number(
                                selectedProfileStudioElement.fontSize ?? 16,
                              ),
                            ),
                          )}
                          px)
                          <input
                            type="range"
                            min={10}
                            max={72}
                            value={Math.max(
                              10,
                              Math.min(
                                72,
                                Number(
                                  selectedProfileStudioElement.fontSize ?? 16,
                                ),
                              ),
                            )}
                            onChange={(event) =>
                              updateFullProfileElement(
                                selectedProfileStudioElement.id,
                                { fontSize: Number(event.target.value) },
                              )
                            }
                          />
                        </label>
                        <label>
                          Text Align
                          <select
                            value={
                              ["left", "center", "right"].includes(
                                selectedProfileStudioElement.align,
                              )
                                ? selectedProfileStudioElement.align
                                : "left"
                            }
                            onChange={(event) =>
                              updateFullProfileElement(
                                selectedProfileStudioElement.id,
                                { align: event.target.value },
                              )
                            }
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                        <label>
                          Text Color
                          <input
                            value={selectedProfileStudioElement.color || ""}
                            placeholder="inherit or #RRGGBB"
                            onChange={(event) =>
                              updateFullProfileElement(
                                selectedProfileStudioElement.id,
                                { color: event.target.value },
                              )
                            }
                          />
                        </label>
                      </>
                    )}
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            {
                              order:
                                Number(
                                  selectedProfileStudioElement.order || 0,
                                ) + 1,
                            },
                          )
                        }
                      >
                        Bring Forward
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() =>
                          nudgeFullProfileElement(
                            selectedProfileStudioElement.id,
                            {
                              order:
                                Number(
                                  selectedProfileStudioElement.order || 0,
                                ) - 1,
                            },
                          )
                        }
                      >
                        Send Back
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() =>
                          removeFullProfileElement(
                            selectedProfileStudioElement.id,
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="hint">Select an element on the canvas.</p>
                )}

                <h4>Theme</h4>
                <label>
                  Canvas Background
                  <input
                    value={fullProfileDraft?.theme?.background || ""}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        theme: {
                          ...(current.theme || {}),
                          background: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Card Surface
                  <input
                    value={fullProfileDraft?.theme?.card || ""}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        theme: {
                          ...(current.theme || {}),
                          card: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Text Color
                  <input
                    value={fullProfileDraft?.theme?.text || ""}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        theme: {
                          ...(current.theme || {}),
                          text: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Accent Color
                  <input
                    value={fullProfileDraft?.theme?.accent || ""}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        theme: {
                          ...(current.theme || {}),
                          accent: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Font Style
                  <select
                    value={
                      ["sans", "serif", "mono", "display"].includes(
                        fullProfileDraft?.theme?.fontPreset,
                      )
                        ? fullProfileDraft.theme.fontPreset
                        : "sans"
                    }
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        theme: {
                          ...(current.theme || {}),
                          fontPreset: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="sans">Modern Sans</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Monospace</option>
                    <option value="display">Display</option>
                  </select>
                </label>

                <h4>Links</h4>
                {(fullProfileDraft?.links || []).map((link) => (
                  <div key={link.id} className="full-profile-link-editor">
                    <input
                      value={link.label || ""}
                      placeholder="Label"
                      onChange={(event) =>
                        updateFullProfileLink(link.id, {
                          label: event.target.value,
                        })
                      }
                    />
                    <input
                      value={link.url || ""}
                      placeholder="https://..."
                      onChange={(event) =>
                        updateFullProfileLink(link.id, {
                          url: event.target.value,
                        })
                      }
                    />
                    <button
                      type="button"
                      className="danger"
                      onClick={() => removeFullProfileLink(link.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ghost"
                  onClick={addFullProfileLink}
                >
                  Add Link
                </button>

                <h4>Profile Music</h4>
                <label>
                  Music URL (MP3/WAV/OGG/M4A)
                  <input
                    value={fullProfileDraft?.music?.url || ""}
                    placeholder="https://... or /v1/profile-images/users/..."
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        music: {
                          ...(current.music || {}),
                          url: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Upload Music
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a"
                    onChange={(event) =>
                      onAudioFieldUpload(event, "profile music", (mediaUrl) =>
                        setFullProfileDraft((current) => ({
                          ...current,
                          mode: "custom",
                          music: { ...(current.music || {}), url: mediaUrl },
                        })),
                      )
                    }
                  />
                </label>
                <label>
                  Volume (
                  {Math.max(
                    0,
                    Math.min(
                      100,
                      Number(fullProfileDraft?.music?.volume ?? 60),
                    ),
                  )}
                  %)
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.max(
                      0,
                      Math.min(
                        100,
                        Number(fullProfileDraft?.music?.volume ?? 60),
                      ),
                    )}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        music: {
                          ...(current.music || {}),
                          volume: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={!!fullProfileDraft?.music?.autoplay}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        music: {
                          ...(current.music || {}),
                          autoplay: event.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Autoplay when opened
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={fullProfileDraft?.music?.loop !== false}
                    onChange={(event) =>
                      setFullProfileDraft((current) => ({
                        ...current,
                        mode: "custom",
                        music: {
                          ...(current.music || {}),
                          loop: event.target.checked,
                        },
                      }))
                    }
                  />{" "}
                  Loop track
                </label>
              </aside>
            </section>
          </div>
  );
}
