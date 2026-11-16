/** Adaptador para un backend Express existente. Node.js 22.13+; no copiar al bundle React. */
let cache;
export async function getNexoStatus() {
  if (cache && cache.until > Date.now()) return cache.value;
  try {
    const {
      NEXO_BASE_URL: base,
      NEXO_PROJECT_TOKEN: token,
      NEXO_PROJECT_ID: expected,
    } = process.env;
    if (!base || !token || !expected)
      throw new Error("Configuración NEXO incompleta");
    const url = new URL("/api/integration/v1/status", base);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
      throw new Error("Se requiere HTTPS");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const value = await res.json();
    if (
      value.project_id !== expected ||
      typeof value.suspended !== "boolean" ||
      typeof value.message !== "string" ||
      value.scope !== "admin_only"
    )
      throw new Error("Respuesta inválida");
    cache = { until: Date.now() + 30000, value: { ...value, available: true } };
    return cache.value;
  } catch (e) {
    console.warn(
      "[NEXO] Servicio de cobro no disponible; contingencia permite acceso.",
      e.message,
    );
    cache = {
      until: Date.now() + 10000,
      value: {
        available: false,
        state: "unavailable",
        suspended: false,
        show_notice: false,
        scope: "admin_only",
        message: "Verificación temporalmente no disponible.",
      },
    };
    return cache.value;
  }
}
/** Montar DESPUÉS de validar sesión y permisos administrativos propios. */
export async function requireNexoAdminAccess(req, res, next) {
  try {
    const status = await getNexoStatus();
    if (status.suspended)
      return res
        .status(402)
        .json({ error: "Alquiler suspendido", billing: status });
    req.nexo = status;
    next();
  } catch (e) {
    next(e);
  }
}
export async function nexoStatusHandler(req, res) {
  res.set("Cache-Control", "no-store");
  res.json(await getNexoStatus());
}
