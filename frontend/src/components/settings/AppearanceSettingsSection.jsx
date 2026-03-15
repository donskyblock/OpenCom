export function AppearanceSettingsSection({
  themeEnabled,
  setThemeEnabled,
  onUploadTheme,
  themeCss,
  setThemeCss,
  onOpenThemeCatalogue,
  onOpenThemeCreator,
}) {
  return (
    <section className="card">
      <h4>Custom CSS Theme</h4>
      <label>
        <input
          type="checkbox"
          checked={themeEnabled}
          onChange={(event) => setThemeEnabled(event.target.checked)}
        />{" "}
        Enable custom CSS
      </label>
      <input type="file" accept="text/css,.css" onChange={onUploadTheme} />
      <textarea
        value={themeCss}
        onChange={(event) => setThemeCss(event.target.value)}
        rows={10}
        placeholder="Paste custom CSS"
      />
      <div className="row-actions" style={{ width: "100%", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="ghost"
          onClick={onOpenThemeCatalogue}
        >
          Open Theme Catalogue
        </button>
        <button
          type="button"
          className="ghost"
          onClick={onOpenThemeCreator}
        >
          Open Theme Creator
        </button>
      </div>
    </section>
  );
}
