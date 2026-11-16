import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  createHash,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  db,
  all,
  get,
  save,
  audit,
  schemas,
  kinds,
  setting,
} from "./store.mjs";
import { billingStatus, invoiceBalance, today, addMonths } from "./billing.mjs";

const app = express();
const port = Number(process.env.PORT || 3001);
const base = new URL(process.env.APP_URL || `http://localhost:${port}`);
const secure = base.protocol === "https:";
if (
  process.env.NODE_ENV === "production" &&
  !secure &&
  !process.env.ALLOW_INSECURE_LOCAL
)
  throw new Error(
    "Producción requiere APP_URL=https://tu-dominio y un proxy HTTPS.",
  );
if (
  !db.prepare("SELECT id FROM admin").get() &&
  !/^[a-f0-9]{64}$/i.test(process.env.SETUP_TOKEN || "")
)
  throw new Error(
    "Antes de iniciar ejecutá npm run init o generá SETUP_TOKEN aleatorio de 64 caracteres hexadecimales.",
  );
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: secure ? [] : null,
      },
    },
    strictTransportSecurity: secure ? undefined : false,
  }),
);
app.use(express.json({ limit: "256kb" }));
const hash = (v) => createHash("sha256").update(v).digest("hex");
const token = () => randomBytes(32).toString("hex");
const passwordHash = (p) => {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(p, salt, 64).toString("hex");
};
const passwordOK = (p, h) => {
  const [s, x] = h.split(":");
  return timingSafeEqual(Buffer.from(x, "hex"), scryptSync(p, s, 64));
};
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intentá en 15 minutos." },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Reintentá en un minuto." },
});
const streams = new Set();
function broadcast() {
  for (const res of streams) res.write("event: change\ndata: {}\n\n");
}
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("Origin") &&
    req.get("Origin") !== base.origin
  )
    return res.status(403).json({ error: "Origen no permitido." });
  next();
});
app.get("/api/health", (_, res) => res.json({ ok: true, version: "1.0.0" }));
app.get("/api/auth/state", (_, res) =>
  res.json({ needs_setup: !db.prepare("SELECT id FROM admin").get() }),
);
app.post("/api/auth/setup", authLimiter, (req, res) => {
  if (db.prepare("SELECT id FROM admin").get())
    return res.status(409).json({ error: "La cuenta ya fue creada." });
  const input = z
    .object({
      setup_token: z.string().min(32).max(200),
      email: z.string().email().max(200),
      password: z.string().min(12).max(200),
    })
    .parse(req.body);
  if (
    !process.env.SETUP_TOKEN ||
    !timingSafeEqual(
      Buffer.from(hash(input.setup_token)),
      Buffer.from(hash(process.env.SETUP_TOKEN)),
    )
  )
    fail("Código de instalación incorrecto.", 403);
  db.prepare("INSERT INTO admin(id,email,password) VALUES(1,?,?)").run(
    input.email.toLowerCase(),
    passwordHash(input.password),
  );
  audit("setup", "admin", "1");
  res.json({ ok: true });
});
app.post("/api/auth/login", authLimiter, (req, res) => {
  const { email, password } = z
    .object({
      email: z.string().email().max(200),
      password: z.string().min(1).max(200),
    })
    .parse(req.body);
  const admin = db.prepare("SELECT * FROM admin").get();
  if (
    !admin ||
    admin.email !== email.toLowerCase() ||
    !passwordOK(password, admin.password)
  )
    fail("Email o contraseña incorrectos.", 401);
  const raw = token(),
    csrf = token();
  db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
  db.prepare("INSERT INTO sessions(hash,csrf,expires) VALUES(?,?,?)").run(
    hash(raw),
    csrf,
    Date.now() + 8 * 60 * 60 * 1000,
  );
  res.cookie("nexo_session", raw, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  });
  audit("login", "admin", "1");
  res.json({ csrf, email: admin.email });
});
app.get("/api/integration/v1/status", apiLimiter, (req, res) => {
  const raw = req.get("Authorization")?.replace(/^Bearer /, "") || "";
  if (raw.length !== 64) fail("Credencial inválida.", 401);
  const key = db
    .prepare("SELECT * FROM integrations WHERE hash=?")
    .get(hash(raw));
  if (!key) fail("Credencial inválida.", 401);
  const project = get("projects", key.project_id);
  if (!project || project.archived) fail("Proyecto no disponible.", 404);
  db.prepare("UPDATE integrations SET last_seen=? WHERE project_id=?").run(
    new Date().toISOString(),
    project.id,
  );
  const status = billingStatus(
    project,
    all("invoices"),
    all("payments"),
    all("advances"),
    today(setting().timezone),
  );
  const notice =
    status.suspended ||
    status.state === "overdue" ||
    status.state === "review" ||
    (status.days_to_due !== null && status.days_to_due <= status.warning_days);
  res.json({
    project_id: project.id,
    project_name: project.name,
    ...status,
    show_notice: notice,
    contact_email: setting().contact_email,
    contact_phone: setting().contact_phone,
  });
});
app.use("/api", (req, res, next) => {
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("nexo_session="))
    ?.slice(13);
  const session =
    raw &&
    db
      .prepare("SELECT * FROM sessions WHERE hash=? AND expires>?")
      .get(hash(raw), Date.now());
  if (!session)
    return res.status(401).json({ error: "Iniciá sesión para continuar." });
  req.session = session;
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("Origin");
    if (origin && origin !== base.origin)
      return res.status(403).json({ error: "Origen no permitido." });
    if (req.get("X-CSRF-Token") !== session.csrf)
      return res
        .status(403)
        .json({ error: "Token de seguridad inválido. Recargá la página." });
  }
  next();
});
app.get("/api/me", (req, res) =>
  res.json({
    email: db.prepare("SELECT email FROM admin").get().email,
    csrf: req.session.csrf,
  }),
);
app.post("/api/auth/logout", (req, res) => {
  db.prepare("DELETE FROM sessions WHERE hash=?").run(req.session.hash);
  res.clearCookie("nexo_session", { path: "/" });
  res.json({ ok: true });
});
app.post("/api/auth/password", (req, res) => {
  const { current, password } = z
    .object({
      current: z.string().max(200),
      password: z.string().min(12).max(200),
    })
    .parse(req.body);
  const a = db.prepare("SELECT * FROM admin").get();
  if (!passwordOK(current, a.password))
    fail("Contraseña actual incorrecta.", 403);
  db.prepare("UPDATE admin SET password=? WHERE id=1").run(
    passwordHash(password),
  );
  db.exec("DELETE FROM sessions");
  audit("password_changed", "admin", "1");
  res.clearCookie("nexo_session", { path: "/" });
  res.json({ ok: true });
});
app.get("/api/events/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");
  streams.add(res);
  const heartbeat = setInterval(() => {
    if (
      req.session.expires < Date.now() ||
      !db
        .prepare("SELECT hash FROM sessions WHERE hash=?")
        .get(req.session.hash)
    ) {
      res.end();
      return;
    }
    res.write(": ping\n\n");
  }, 20000);
  req.on("close", () => {
    clearInterval(heartbeat);
    streams.delete(res);
  });
});
app.get("/api/state", (req, res) => {
  const state = Object.fromEntries(kinds.map((k) => [k, all(k)]));
  const date = today(setting().timezone);
  state.statuses = Object.fromEntries(
    state.projects.map((p) => [
      p.id,
      billingStatus(p, state.invoices, state.payments, state.advances, date),
    ]),
  );
  state.integrations = db
    .prepare("SELECT project_id,last_seen FROM integrations")
    .all();
  state.settings = setting();
  state.email_ready = !!process.env.SMTP_HOST;
  state.today = date;
  res.json(state);
});
function validateRelations(kind, p, id) {
  if (p.project_id && !get("projects", p.project_id))
    fail("Proyecto inexistente.");
  if (kind === "projects") {
    if (p.client_id && !get("clients", p.client_id))
      fail("Cliente inexistente.");
    if (p.manual_suspended && !p.suspension_reason.trim())
      fail("Indicá el motivo de la suspensión.");
    if (
      p.auto_suspend &&
      (!p.policy_accepted || !p.billing_enabled || p.phase !== "active")
    )
      fail(
        "La suspensión automática requiere alquiler activo, proyecto operativo y una política acordada.",
      );
  }
  if (kind === "invoices") {
    const current = id && get(kind, id);
    const receipts = all("payments").filter(
      (x) => x.invoice_id === id && !x.voided,
    );
    if (
      receipts.length &&
      (p.voided ||
        p.amount_cents !== current.amount_cents ||
        p.currency !== current.currency ||
        p.project_id !== current.project_id)
    )
      fail(
        "Primero anulá los pagos vinculados; después podrás corregir o anular el cargo.",
      );
    if (
      p.period &&
      all("invoices").some(
        (i) =>
          i.id !== id &&
          !i.voided &&
          !p.voided &&
          i.project_id === p.project_id &&
          i.period === p.period,
      )
    )
      fail("Ya existe un cargo vigente para ese período.");
  }
  if (kind === "payments") {
    const invoice = get("invoices", p.invoice_id);
    if (
      !invoice ||
      invoice.project_id !== p.project_id ||
      invoice.currency !== p.currency ||
      invoice.voided
    )
      fail(
        "El pago debe corresponder a un cargo vigente del mismo proyecto y moneda.",
      );
    const balance = invoiceBalance(
      invoice,
      all("payments").filter((x) => x.id !== id),
    );
    if (!p.voided && p.amount_cents > balance)
      fail(
        "El pago supera el saldo del cargo. Registrá anticipos por separado.",
      );
  }
}
app.post("/api/records/:kind", (req, res) => {
  const { kind } = req.params;
  if (!schemas[kind]) fail("Tipo de registro inválido.", 404);
  const data = schemas[kind].parse(req.body);
  validateRelations(kind, data);
  const item = save(kind, data);
  audit("create", kind, item.id);
  broadcast();
  res.status(201).json(item);
});
app.put("/api/records/:kind/:id", (req, res) => {
  const { kind, id } = req.params;
  if (!schemas[kind] || !get(kind, id)) fail("Registro inexistente.", 404);
  const revision = z.number().int().positive().parse(req.body.revision);
  const data = schemas[kind].parse(req.body);
  validateRelations(kind, data, id);
  const item = save(kind, data, id, revision);
  audit("update", kind, id);
  broadcast();
  res.json(item);
});
app.delete("/api/records/:kind/:id", (req, res) => {
  const { kind, id } = req.params;
  const current = get(kind, id);
  if (!current) fail("Registro inexistente.", 404);
  if (!["tasks", "notes", "events"].includes(kind))
    fail(
      "Para preservar el historial, archivá el cliente/proyecto o anulá el comprobante.",
    );
  const revision = z.number().int().positive().parse(req.body.revision);
  const result = db
    .prepare("DELETE FROM records WHERE type=? AND id=? AND revision=?")
    .run(kind, id, revision);
  if (!result.changes) fail("El registro fue modificado en otra ventana.", 409);
  audit("delete", kind, id);
  broadcast();
  res.json({ ok: true });
});
app.post("/api/billing/generate", (req, res) => {
  const { month, project_id } = z
    .object({
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
      project_id: z.string().optional(),
    })
    .parse(req.body);
  const created = [],
    skipped = [];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const p of all("projects").filter(
      (p) => !p.archived && (!project_id || p.id === project_id),
    )) {
      if (
        !p.billing_enabled ||
        p.phase !== "active" ||
        !p.billing_start ||
        !p.monthly_cents
      ) {
        skipped.push({
          project: p.name,
          reason: "Alquiler sin configurar o inactivo",
        });
        continue;
      }
      const start = p.billing_start;
      const n =
        (Number(month.slice(0, 4)) - Number(start.slice(0, 4))) * 12 +
        Number(month.slice(5)) -
        Number(start.slice(5, 7));
      if (n < 0) {
        skipped.push({ project: p.name, reason: "Período anterior al inicio" });
        continue;
      }
      const period = addMonths(start, n),
        end = addMonths(start, n + 1);
      if (
        all("invoices").some(
          (i) => i.project_id === p.id && i.period === period && !i.voided,
        )
      ) {
        skipped.push({ project: p.name, reason: "Cargo ya existente" });
        continue;
      }
      const covered = all("advances").some(
        (a) =>
          a.project_id === p.id &&
          a.paid &&
          !a.voided &&
          a.start_date &&
          a.start_date <= period &&
          addMonths(a.start_date, a.months) >= end,
      );
      if (covered) {
        skipped.push({
          project: p.name,
          reason: "Período cubierto por adelanto confirmado",
        });
        continue;
      }
      const i = save("invoices", {
        project_id: p.id,
        description: `Alquiler de panel · ${month}`,
        amount_cents: p.monthly_cents,
        currency: p.currency,
        due_date: period,
        period,
      });
      created.push(i);
      audit("generate", "invoices", i.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  broadcast();
  res.json({ created, skipped });
});
app.post("/api/integrations/:id/rotate", (req, res) => {
  const project = get("projects", req.params.id);
  if (!project) fail("Proyecto inexistente.", 404);
  const raw = token();
  db.prepare(
    "INSERT INTO integrations(project_id,hash,last_seen) VALUES(?,?,NULL) ON CONFLICT(project_id) DO UPDATE SET hash=excluded.hash,last_seen=NULL",
  ).run(project.id, hash(raw));
  audit("rotate_token", "integrations", project.id);
  broadcast();
  res.json({
    token: raw,
    endpoint: base.origin + "/api/integration/v1/status",
  });
});
app.delete("/api/integrations/:id", (req, res) => {
  db.prepare("DELETE FROM integrations WHERE project_id=?").run(req.params.id);
  audit("revoke", "integrations", req.params.id);
  broadcast();
  res.json({ ok: true });
});
app.put("/api/settings", (req, res) => {
  const data = z
    .object({
      brand: z.string().trim().min(1).max(60),
      owner: z.string().max(100),
      timezone: z
        .string()
        .max(100)
        .refine((s) => {
          try {
            today(s);
            return true;
          } catch {
            return false;
          }
        }, "Zona horaria inválida"),
      contact_email: z.union([z.string().email(), z.literal("")]),
      contact_phone: z.string().max(100),
    })
    .parse(req.body);
  db.prepare(
    "INSERT INTO meta(key,value) VALUES('settings',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  ).run(JSON.stringify(data));
  audit("update", "settings", null);
  broadcast();
  res.json(data);
});
app.get("/api/audit", (req, res) =>
  res.json(db.prepare("SELECT * FROM audit ORDER BY id DESC LIMIT 300").all()),
);
app.get("/api/export", (req, res) => {
  const records = Object.fromEntries(kinds.map((k) => [k, all(k)]));
  audit("export", "records", null);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nexo-registros-${today()}.json"`,
  );
  res.json({
    version: 1,
    exported_at: new Date().toISOString(),
    settings: setting(),
    records,
    note: "Exportación de registros, no incluye cuenta, sesiones ni tokens. Usá npm run backup para una copia completa.",
  });
});
app.post("/api/messages/:id/send", async (req, res) => {
  const msg = get("messages", req.params.id);
  if (!msg) fail("Mensaje inexistente.", 404);
  if (msg.status === "sent") fail("El mensaje ya figura enviado.");
  if (msg.channel !== "email")
    fail("El envío automático está disponible solo para email.");
  if (!process.env.SMTP_HOST)
    fail(
      "Configurá SMTP en el servidor para enviar correos. También podés abrir un borrador externo.",
    );
  const recipient = z.string().email().parse(msg.recipient);
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    socketTimeout: 20000,
  });
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: msg.subject,
      text: msg.body,
    });
    save("messages", { ...msg, status: "sent" }, msg.id, msg.revision);
    audit("smtp_accepted", "messages", msg.id);
    broadcast();
    res.json({
      ok: true,
      message:
        "El servidor SMTP aceptó el correo; eso no garantiza entrega en la bandeja de entrada.",
    });
  } catch (e) {
    save("messages", { ...msg, status: "failed" }, msg.id, msg.revision);
    audit("smtp_failed", "messages", msg.id);
    broadcast();
    res
      .status(502)
      .json({
        error:
          "El servidor SMTP no aceptó el envío. Revisá credenciales y conectividad.",
      });
  }
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Ruta no encontrada." }),
);
const dist = resolve("dist");
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false }));
  app.get("/{*path}", (req, res) =>
    res.type("html").send(readFileSync(resolve(dist, "index.html"))),
  );
}
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof z.ZodError)
    return res
      .status(400)
      .json({
        error: err.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(" · "),
      });
  console.error(err.status ? "Solicitud rechazada: " + err.message : err);
  res
    .status(err.status || 500)
    .json({
      error: err.status
        ? err.message
        : "Error interno. Revisá el registro del servidor.",
    });
});
const server = app.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(
    `Nexo en ${base.origin} · DB local persistente · ${new Date().toISOString()}`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    for (const r of streams) r.end();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
