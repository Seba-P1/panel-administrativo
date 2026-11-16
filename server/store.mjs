import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
export const dataDir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, "nexo.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
);
db.exec(`CREATE TABLE IF NOT EXISTS records(type TEXT NOT NULL,id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS records_type ON records(type);
CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS integrations(project_id TEXT PRIMARY KEY,hash TEXT NOT NULL,last_seen TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,action TEXT NOT NULL,entity TEXT NOT NULL,record_id TEXT,details TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
const text = z.string().trim().max(5000).default("");
const name = z.string().trim().min(1).max(180);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v + "T12:00:00Z")) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
const optDate = z.union([date, z.literal("")]).default("");
const url = z
  .union([
    z.literal(""),
    z
      .string()
      .url()
      .max(2000)
      .refine(
        (v) => ["https:", "http:"].includes(new URL(v).protocol),
        "Usá http o https",
      ),
  ])
  .default("");
const email = z.union([z.string().email().max(200), z.literal("")]).default("");
const currency = z.enum(["ARS", "USD", "EUR"]);
const amount = z.number().int().min(1).max(1_000_000_000_000);
export const schemas = {
  clients: z.object({
    name,
    email,
    phone: text,
    company: text,
    notes: text,
    archived: z.boolean().default(false),
  }),
  projects: z.object({
    name,
    client_id: z.string().max(100).default(""),
    intermediary: text,
    website: url,
    admin_url: url,
    repository: url,
    hosting: text,
    phase: z
      .enum(["active", "development", "planned", "demo", "paused"])
      .default("planned"),
    description: text,
    monthly_cents: z.number().int().min(0).max(1_000_000_000_000).default(0),
    currency: currency.default("ARS"),
    billing_start: optDate,
    billing_enabled: z.boolean().default(false),
    auto_suspend: z.boolean().default(false),
    policy_accepted: z.boolean().default(false),
    grace_days: z.number().int().min(0).max(90).default(7),
    warning_days: z.number().int().min(0).max(90).default(7),
    manual_suspended: z.boolean().default(false),
    suspension_reason: text,
    archived: z.boolean().default(false),
  }),
  invoices: z.object({
    project_id: z.string().min(1),
    description: name,
    amount_cents: amount,
    currency,
    due_date: date,
    period: optDate,
    voided: z.boolean().default(false),
    notes: text,
  }),
  payments: z.object({
    project_id: z.string().min(1),
    invoice_id: z.string().min(1),
    amount_cents: amount,
    currency,
    date,
    method: text,
    reference: text,
    voided: z.boolean().default(false),
  }),
  advances: z.object({
    project_id: z.string().min(1),
    months: z.number().int().min(1).max(120),
    start_date: optDate,
    paid: z.boolean().default(true),
    amount_cents: z
      .number()
      .int()
      .min(0)
      .max(1_000_000_000_000)
      .nullable()
      .default(null),
    currency: currency.default("ARS"),
    notes: text,
    voided: z.boolean().default(false),
  }),
  tasks: z.object({
    project_id: z.string().default(""),
    title: name,
    description: text,
    status: z.enum(["todo", "doing", "review", "done"]).default("todo"),
    priority: z.enum(["low", "normal", "high"]).default("normal"),
    due_date: optDate,
  }),
  notes: z.object({
    project_id: z.string().min(1),
    title: name,
    body: z.string().max(20000).default(""),
  }),
  events: z
    .object({
      project_id: z.string().default(""),
      title: name,
      date,
      start_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default("09:00"),
      end_time: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .default("10:00"),
      description: text,
    })
    .refine(
      (e) => e.end_time > e.start_time,
      "La hora final debe ser posterior a la inicial",
    ),
  messages: z.object({
    project_id: z.string().min(1),
    subject: name,
    body: z.string().min(1).max(10000),
    channel: z.enum(["email", "whatsapp", "note"]),
    status: z.enum(["draft", "sent", "failed"]).default("draft"),
    recipient: text,
  }),
};
export const kinds = Object.keys(schemas);
export function all(type) {
  return db
    .prepare("SELECT * FROM records WHERE type=? ORDER BY created_at DESC,id")
    .all(type)
    .map(decode);
}
export function get(type, id) {
  const row = db
    .prepare("SELECT * FROM records WHERE type=? AND id=?")
    .get(type, id);
  return row ? decode(row) : null;
}
function decode(r) {
  return {
    ...JSON.parse(r.data),
    id: r.id,
    revision: r.revision,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}
export function save(type, data, id = null, revision = null) {
  const parsed = schemas[type].parse(data);
  const at = new Date().toISOString();
  const key = id || randomUUID();
  if (id) {
    const result = db
      .prepare(
        "UPDATE records SET data=?,revision=revision+1,updated_at=? WHERE type=? AND id=? AND revision=?",
      )
      .run(JSON.stringify(parsed), at, type, id, revision);
    if (!result.changes)
      throw Object.assign(
        new Error(
          "El registro cambió en otra ventana. Recargá antes de guardar.",
        ),
        { status: 409 },
      );
  } else
    db.prepare(
      "INSERT INTO records(type,id,data,created_at,updated_at) VALUES(?,?,?,?,?)",
    ).run(type, key, JSON.stringify(parsed), at, at);
  return get(type, key);
}
export function audit(action, entity, id, details = {}) {
  db.prepare(
    "INSERT INTO audit(at,action,entity,record_id,details) VALUES(?,?,?,?,?)",
  ).run(
    new Date().toISOString(),
    action,
    entity,
    id || null,
    JSON.stringify(details),
  );
}
export function setting() {
  const raw = db.prepare("SELECT value FROM meta WHERE key='settings'").get();
  return raw
    ? JSON.parse(raw.value)
    : {
        brand: "Nexo",
        owner: "Mi estudio",
        timezone: "America/Argentina/Buenos_Aires",
        contact_email: "",
        contact_phone: "",
      };
}
if (!db.prepare("SELECT value FROM meta WHERE key='seeded'").get()) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const c1 = save("clients", {
      name: "YPF",
      company: "YPF",
      notes:
        "Intermediario: Esteban Ochipinti. Confirmar contacto responsable y condiciones del alquiler.",
    });
    const c2 = save("clients", {
      name: "Jorge Tanos",
      notes:
        "Cliente de RC Play. Se informó un adelanto de 6 meses; inicio y monto por confirmar.",
    });
    const c3 = save("clients", {
      name: "Juan Guenumil",
      notes:
        "Nombre inferido del dominio, confirmar razón social y contacto. No pagó ningún mes según el registro inicial.",
    });
    const c4 = save("clients", {
      name: "Mutual 1 de Noviembre",
      company: "Mutual 1 de Noviembre — Bahía Blanca",
    });
    const c5 = save("clients", { name: "Bardas Bajas" });
    const c6 = save("clients", { name: "Pelota Paleta Atletico" });
    const projects = [
      {
        name: "YP Telpuente",
        client_id: c1.id,
        website: "https://yptelpuente.com.ar",
        phase: "active",
        intermediary: "Esteban Ochipinti",
        description:
          "Cliente YPF. Confirmar monto, período de alquiler y estado de cobro.",
      },
      {
        name: "RC Play",
        client_id: c2.id,
        website: "https://rcplay.com.ar",
        phase: "active",
        description:
          "Jorge Tanos pagó 6 meses adelantados. Falta confirmar fecha de inicio, año e importe.",
      },
      {
        name: "Juan Guenumil",
        client_id: c3.id,
        website: "https://juanguenumil.com.ar",
        phase: "active",
        description:
          "No abonó ningún mes de alquiler. Confirmar inicio y tarifa antes de calcular una deuda.",
      },
      {
        name: "Mutual 1 de Noviembre",
        client_id: c4.id,
        phase: "development",
        description:
          "Proyecto en creación en Bahía Blanca; todavía no está en funcionamiento.",
      },
      {
        name: "Bardas Bajas",
        client_id: c5.id,
        phase: "planned",
        description:
          "Proyecto pendiente de creación; todavía no está en funcionamiento.",
      },
      {
        name: "Pelota Paleta Atletico",
        client_id: c6.id,
        phase: "demo",
        description:
          "Proyecto en fase demo; todavía no habilitado para alquiler.",
      },
    ].map((p) => save("projects", p));
    save("advances", {
      project_id: projects[1].id,
      months: 6,
      paid: true,
      notes:
        "Dato aportado por el titular: 6 meses adelantados, «creo que desde el mes 7». NO se confirmó ni el año ni la fecha exacta. No se incluye en ingresos hasta tener importe. No marcar como saldo a favor además de pagar los mismos cargos.",
    });
    for (const [i, title] of [
      [0, "Confirmar contacto, tarifa y período de alquiler"],
      [1, "Confirmar desde qué fecha corren los 6 meses adelantados"],
      [2, "Confirmar inicio de alquiler y preparar cargos pendientes"],
      [3, "Completar desarrollo y fecha de lanzamiento"],
      [4, "Definir alcance del proyecto"],
      [5, "Revisar demo con el cliente"],
    ])
      save("tasks", {
        project_id: projects[i].id,
        title,
        status: "todo",
        priority: i === 2 ? "high" : "normal",
      });
    db.prepare("INSERT INTO meta(key,value) VALUES('seeded','1')").run();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
