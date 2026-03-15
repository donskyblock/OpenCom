import { useEffect } from "react";

function ReactionPickerButton({
  emote,
  secondaryText = "",
  onSelect,
}) {
  if (!emote?.name) return null;

  return (
    <button
      type="button"
      className="reaction-picker-item"
      onClick={() => onSelect(emote.name)}
      title={`:${emote.name}:`}
    >
      <span className="reaction-picker-item-visual" aria-hidden="true">
        {emote.type === "custom" ? (
          <img
            className="message-custom-emote"
            src={emote.imageUrl}
            alt={`:${emote.name}:`}
          />
        ) : (
          <span>{emote.value}</span>
        )}
      </span>
      <span className="reaction-picker-item-copy">
        <strong>:{emote.name}:</strong>
        {secondaryText ? <small>{secondaryText}</small> : null}
      </span>
    </button>
  );
}

export function MessageReactionPickerModal({
  open,
  onClose,
  query,
  setQuery,
  customSections,
  builtinSections,
  searchResults,
  onSelect,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const trimmedQuery = String(query || "").trim();
  const searching = trimmedQuery.length > 0;

  return (
    <div
      className="settings-overlay reaction-picker-overlay"
      onClick={onClose}
    >
      <div
        className="add-server-modal reaction-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add reaction"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="reaction-picker-header">
          <div>
            <h3>Add reaction</h3>
            <p className="hint">
              Search built-in emoji and custom emotes, then drop one straight on
              the message.
            </p>
          </div>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </header>

        <input
          autoFocus
          className="reaction-picker-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search emoji and emotes"
        />

        <div className="reaction-picker-body">
          {searching ? (
            searchResults.length > 0 ? (
              <section className="reaction-picker-section">
                <header className="reaction-picker-heading">
                  Results for {trimmedQuery}
                </header>
                <div className="reaction-picker-grid">
                  {searchResults.map((emote) => (
                    <ReactionPickerButton
                      key={emote.id || emote.name}
                      emote={emote}
                      secondaryText={
                        emote.type === "custom"
                          ? emote.scopeLabel || "Custom emote"
                          : emote.categoryLabel || "Built-in emoji"
                      }
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <p className="hint reaction-picker-empty">
                No emoji or emotes match that search yet.
              </p>
            )
          ) : (
            <>
              {customSections.map((section) => (
                <section key={section.id} className="reaction-picker-section">
                  <header className="reaction-picker-heading">
                    {section.heading}
                  </header>
                  <div className="reaction-picker-grid">
                    {section.items.map((emote) => (
                      <ReactionPickerButton
                        key={emote.id || emote.name}
                        emote={{ ...emote, type: "custom" }}
                        secondaryText={
                          section.id === "current-server"
                            ? "Custom emote"
                            : emote.scopeLabel || "Custom emote"
                        }
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </section>
              ))}

              {builtinSections.map((section) => (
                <section key={section.id} className="reaction-picker-section">
                  <header className="reaction-picker-heading">
                    {section.heading}
                  </header>
                  <div className="reaction-picker-grid">
                    {section.items.map((emote) => (
                      <ReactionPickerButton
                        key={emote.id || emote.name}
                        emote={emote}
                        secondaryText={emote.value}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
