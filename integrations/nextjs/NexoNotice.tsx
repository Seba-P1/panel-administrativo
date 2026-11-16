"use client";
import { useEffect, useState } from "react";
import type { NexoStatus } from "./nexo.server";

/** Montar solo dentro del panel ya autenticado. La ruta de refresco debe validar tu sesión. */
export default function NexoNotice({
  initial,
  refreshUrl = "/api/admin/nexo-status",
}: {
  initial: NexoStatus;
  refreshUrl?: string;
}) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const refresh = async () => {
      try {
        const r = await fetch(refreshUrl, {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const value = await r.json();
          if (
            typeof value.suspended === "boolean" &&
            typeof value.message === "string"
          )
            setStatus(value);
        }
      } catch {
        /* La validación real ocurre en el servidor, no acá. */
      }
    };
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refreshUrl]);
  if (!status.show_notice && !status.suspended) return null;
  return (
    <aside
      role="status"
      style={{
        border: `1px solid ${status.suspended ? "#e7b5a9" : "#f0d2af"}`,
        background: status.suspended ? "#fff0ec" : "#fff7ec",
        color: "#6b4936",
        borderRadius: 12,
        padding: "14px 18px",
        fontFamily: "inherit",
        marginBottom: 20,
      }}
    >
      <strong>
        {status.suspended
          ? "Acceso administrativo suspendido"
          : status.state === "overdue"
            ? "Alquiler pendiente de pago"
            : "Información de tu alquiler"}
      </strong>
      <p style={{ margin: "6px 0", fontSize: 14 }}>{status.message}</p>
      {Object.entries(status.debt_by_currency || {}).map(
        ([currency, cents]) => (
          <p key={currency} style={{ margin: 4, fontSize: 13 }}>
            Saldo de cargos:{" "}
            {new Intl.NumberFormat("es-AR", {
              style: "currency",
              currency,
            }).format(cents / 100)}
          </p>
        ),
      )}
      {status.contact_email && (
        <a href={"mailto:" + status.contact_email}>
          Contactar al administrador
        </a>
      )}
    </aside>
  );
}
