export function activateClient(app) {
  app?.registerPanel?.({ id: "welcome-badge", title: "Welcome Badge" });
}
