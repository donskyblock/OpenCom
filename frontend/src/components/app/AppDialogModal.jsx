export function AppDialogModal({
  dialogModal,
  resolveDialog,
  setDialogModal,
  dialogInputRef,
}) {
  if (!dialogModal) return null;

  return (
        <div
          className="settings-overlay"
          onClick={() =>
            resolveDialog(dialogModal.type === "confirm" ? false : null)
          }
        >
          <div
            className="add-server-modal opencom-dialog-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{dialogModal.title}</h3>
            <p className="hint opencom-dialog-message">{dialogModal.message}</p>
            {dialogModal.type === "prompt" && (
              <input
                ref={dialogInputRef}
                value={dialogModal.value}
                onChange={(event) =>
                  setDialogModal((current) =>
                    current
                      ? { ...current, value: event.target.value }
                      : current,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    resolveDialog(null);
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    resolveDialog(dialogModal.value);
                  }
                }}
              />
            )}
            <div className="row-actions opencom-dialog-actions">
              {dialogModal.type !== "alert" && (
                <button
                  className="ghost"
                  onClick={() =>
                    resolveDialog(dialogModal.type === "confirm" ? false : null)
                  }
                >
                  {dialogModal.cancelLabel || "Cancel"}
                </button>
              )}
              <button
                onClick={() =>
                  resolveDialog(
                    dialogModal.type === "prompt" ? dialogModal.value : true,
                  )
                }
              >
                {dialogModal.confirmLabel || "OK"}
              </button>
            </div>
          </div>
        </div>
  );
}
