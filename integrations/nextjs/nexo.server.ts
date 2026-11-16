import "server-only";

/** Copiar a src/lib/nexo.server.ts. Requiere Node.js runtime, no Edge. */
export type NexoStatus = {
  available: boolean;
  project_id?: string;
  project_name?: string;
  state: string;
  message: string;
  suspended: boolean;
  show_notice: boolean;
  scope: "admin_only";
  days_to_due?: number | null;
  next_due?: string | null;
  coverage_end?: string | null;
  debt_by_currency?: Record<string, number>;
  contact_email?: string;
  contact_phone?: string;
};
let cached: { until: number; value: NexoStatus } | undefined;
export async function getNexoStatus(): Promise<NexoStatus> {
  if (cached && cached.until > Date.now()) return cached.value;
  try {
    const base = process.env.NEXO_BASE_URL;
    const token = process.env.NEXO_PROJECT_TOKEN;
    const expected = process.env.NEXO_PROJECT_ID;
    if (!base || !token || !expected)
      throw new Error("Configuración NEXO incompleta");
    const url = new URL("/api/integration/v1/status", base);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:")
      throw new Error("NEXO requiere HTTPS en producción");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`NEXO HTTP ${response.status}`);
    const value = await response.json();
    if (
      value.project_id !== expected ||
      typeof value.suspended !== "boolean" ||
      typeof value.message !== "string" ||
      value.scope !== "admin_only"
    )
      throw new Error("Respuesta NEXO inválida");
    const status: NexoStatus = { ...value, available: true };
    cached = { until: Date.now() + 30_000, value: status };
    return status;
  } catch (error) {
    // No registrar tokens ni datos privados. Enlazar este aviso al monitoreo de tu hosting.
    console.warn(
      "[NEXO] Consulta no disponible; acceso administrativo permitido por política de contingencia.",
      error instanceof Error ? error.message : "error",
    );
    const fallback: NexoStatus = {
      available: false,
      state: "unavailable",
      suspended: false,
      show_notice: false,
      scope: "admin_only",
      message:
        "La verificación del alquiler no está disponible. Contactá al administrador si persiste.",
    };
    cached = { until: Date.now() + 10_000, value: fallback };
    return fallback;
  }
}
export class NexoSuspendedError extends Error {
  constructor(public readonly status: NexoStatus) {
    super(status.message);
    this.name = "NexoSuspendedError";
  }
}
/** Primero validar la sesión y los permisos propios del sitio; después ejecutar este guard. */
export async function assertNexoAdminAccess(): Promise<NexoStatus> {
  const status = await getNexoStatus();
  if (status.suspended) throw new NexoSuspendedError(status);
  return status;
}
