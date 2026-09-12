// Service worker mínimo — só existe para habilitar o prompt de instalação
// do PWA (ADR-012). Sem cache/offline no MVP (fora de escopo).
self.addEventListener("fetch", () => {});
