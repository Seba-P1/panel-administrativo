import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import net from "node:net";
const dir = mkdtempSync(join(tmpdir(), "nexo-test-"));
const secret = "a".repeat(64);
let child,
  base,
  cookie = "",
  csrf = "",
  state,
  invoice,
  payment,
  key,
  project;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function request(path, method = "GET", data, headers = {}) {
  const r = await fetch(base + "/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      "X-CSRF-Token": csrf,
      ...headers,
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let body;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, body, headers: r.headers };
}
before(async () => {
  const server = net.createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  await new Promise((r) => server.close(r));
  base = "http://127.0.0.1:" + port;
  child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      DATA_DIR: dir,
      PORT: String(port),
      HOST: "127.0.0.1",
      APP_URL: base,
      SETUP_TOKEN: secret,
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stderr.on("data", (b) => (logs += b));
  for (let i = 0; i < 80; i++) {
    try {
      const r = await request("/health");
      if (r.status === 200) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Servidor no inició: " + logs);
});
after(async () => {
  if (child) {
    const done = new Promise((r) => child.once("exit", r));
    child.kill("SIGTERM");
    await done;
  }
  rmSync(dir, { recursive: true, force: true });
});
test("API protegida rechaza acceso anónimo", async () => {
  assert.equal((await request("/state")).status, 401);
});
test("Instalación rechaza código incorrecto", async () => {
  assert.equal(
    (
      await request("/auth/setup", "POST", {
        setup_token: "b".repeat(64),
        email: "test@example.com",
        password: "Una-clave-muy-larga-123",
      })
    ).status,
    403,
  );
});
test("Instalación y login seguros", async () => {
  assert.equal(
    (
      await request("/auth/setup", "POST", {
        setup_token: secret,
        email: "test@example.com",
        password: "Una-clave-muy-larga-123",
      })
    ).status,
    200,
  );
  const r = await request("/auth/login", "POST", {
    email: "test@example.com",
    password: "Una-clave-muy-larga-123",
  });
  assert.equal(r.status, 200);
  cookie = r.headers.get("set-cookie").split(";")[0];
  csrf = r.body.csrf;
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
});
test("No permite reinstalar sobre una cuenta existente", async () => {
  assert.equal(
    (
      await request("/auth/setup", "POST", {
        setup_token: secret,
        email: "otra@example.com",
        password: "Una-clave-muy-larga-123",
      })
    ).status,
    409,
  );
});
test("Precarga exactamente seis proyectos y no inventa recibos", async () => {
  const r = await request("/state");
  assert.equal(r.status, 200);
  state = r.body;
  assert.equal(state.projects.length, 6);
  assert.equal(state.projects.filter((p) => p.phase === "active").length, 3);
  assert.equal(state.payments.length, 0);
  assert.equal(state.invoices.length, 0);
  const rc = state.projects.find((p) => p.name === "RC Play");
  assert.equal(state.statuses[rc.id].state, "review");
  assert.equal(state.advances[0].months, 6);
  assert.equal(state.advances[0].start_date, "");
  assert.equal(state.advances[0].amount_cents, null);
  project = state.projects.find((p) => p.name === "Juan Guenumil");
});
test("Rechaza cambios sin CSRF y desde otro origen", async () => {
  assert.equal(
    (
      await request(
        "/records/notes",
        "POST",
        { project_id: project.id, title: "x" },
        { "X-CSRF-Token": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/records/notes",
        "POST",
        { project_id: project.id, title: "x" },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
});
test("CRUD y control de conflictos de edición", async () => {
  const a = await request("/records/notes", "POST", {
    project_id: project.id,
    title: "Nota de prueba",
    body: "Contenido",
  });
  assert.equal(a.status, 201);
  const b = await request("/records/notes/" + a.body.id, "PUT", {
    ...a.body,
    title: "Editada",
  });
  assert.equal(b.status, 200);
  assert.equal(
    (
      await request("/records/notes/" + a.body.id, "PUT", {
        ...a.body,
        title: "Desactualizada",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/records/notes/" + a.body.id, "DELETE", {
        revision: b.body.revision,
      })
    ).status,
    200,
  );
});
test("Valida fechas reales y relaciones", async () => {
  assert.equal(
    (
      await request("/records/invoices", "POST", {
        project_id: project.id,
        description: "Inválido",
        amount_cents: 100,
        currency: "ARS",
        due_date: "2026-02-31",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/records/notes", "POST", {
        project_id: "no-existe",
        title: "Inválido",
      })
    ).status,
    400,
  );
});
test("Registra cargo y rechaza pagos superiores al saldo o con otra moneda", async () => {
  const r = await request("/records/invoices", "POST", {
    project_id: project.id,
    description: "Alquiler prueba",
    amount_cents: 10000,
    currency: "ARS",
    due_date: "2026-01-01",
  });
  assert.equal(r.status, 201);
  invoice = r.body;
  assert.equal(
    (
      await request("/records/payments", "POST", {
        project_id: project.id,
        invoice_id: invoice.id,
        amount_cents: 10001,
        currency: "ARS",
        date: "2026-01-02",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/records/payments", "POST", {
        project_id: project.id,
        invoice_id: invoice.id,
        amount_cents: 100,
        currency: "USD",
        date: "2026-01-02",
      })
    ).status,
    400,
  );
  const p = await request("/records/payments", "POST", {
    project_id: project.id,
    invoice_id: invoice.id,
    amount_cents: 3000,
    currency: "ARS",
    date: "2026-01-02",
    method: "Transferencia",
  });
  assert.equal(p.status, 201);
  payment = p.body;
});
test("No altera importe de un cargo con pagos vigentes", async () => {
  assert.equal(
    (
      await request("/records/invoices/" + invoice.id, "PUT", {
        ...invoice,
        amount_cents: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/records/invoices/" + invoice.id, "DELETE", {
        revision: invoice.revision,
      })
    ).status,
    400,
  );
});
test("Conector aislado por proyecto y sin notas privadas", async () => {
  const r = await request(
    "/integrations/" + project.id + "/rotate",
    "POST",
    {},
  );
  assert.equal(r.status, 200);
  key = r.body.token;
  const x = await request("/integration/v1/status", "GET", undefined, {
    Authorization: "Bearer " + key,
    Cookie: "",
  });
  assert.equal(x.status, 200);
  assert.equal(x.body.project_id, project.id);
  assert.equal(x.body.suspended, false);
  assert.equal(x.body.debt_by_currency.ARS, 7000);
  assert.equal(x.body.notes, undefined);
  assert.equal(x.body.scope, "admin_only");
  assert.equal(
    (
      await request("/state", "GET", undefined, {
        Cookie: "",
        Authorization: "Bearer " + key,
      })
    ).status,
    401,
  );
});
test("Suspensión requiere motivo y autorización de política", async () => {
  assert.equal(
    (
      await request("/records/projects/" + project.id, "PUT", {
        ...project,
        manual_suspended: true,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/records/projects/" + project.id, "PUT", {
        ...project,
        auto_suspend: true,
      })
    ).status,
    400,
  );
  const r = await request("/records/projects/" + project.id, "PUT", {
    ...project,
    billing_enabled: true,
    policy_accepted: true,
    auto_suspend: true,
    billing_start: "2026-01-01",
    monthly_cents: 10000,
  });
  assert.equal(r.status, 200);
  project = r.body;
  const status = await request("/integration/v1/status", "GET", undefined, {
    Authorization: "Bearer " + key,
    Cookie: "",
  });
  assert.equal(status.body.suspended, true);
});
test("Pago completo rehabilita suspensión automática", async () => {
  assert.equal(
    (
      await request("/records/payments", "POST", {
        project_id: project.id,
        invoice_id: invoice.id,
        amount_cents: 7000,
        currency: "ARS",
        date: "2026-01-03",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/integration/v1/status", "GET", undefined, {
        Authorization: "Bearer " + key,
        Cookie: "",
      })
    ).body.suspended,
    false,
  );
});
test("Rotación y revocación invalidan credenciales anteriores", async () => {
  const r = await request(
    "/integrations/" + project.id + "/rotate",
    "POST",
    {},
  );
  assert.equal(
    (
      await request("/integration/v1/status", "GET", undefined, {
        Authorization: "Bearer " + key,
        Cookie: "",
      })
    ).status,
    401,
  );
  key = r.body.token;
  assert.equal(
    (await request("/integrations/" + project.id, "DELETE", {})).status,
    200,
  );
  assert.equal(
    (
      await request("/integration/v1/status", "GET", undefined, {
        Authorization: "Bearer " + key,
        Cookie: "",
      })
    ).status,
    401,
  );
});
test("Generación mensual idempotente", async () => {
  const a = await request("/billing/generate", "POST", {
    month: "2026-03",
    project_id: project.id,
  });
  assert.equal(a.status, 200);
  assert.equal(a.body.created.length, 1);
  const b = await request("/billing/generate", "POST", {
    month: "2026-03",
    project_id: project.id,
  });
  assert.equal(b.body.created.length, 0);
});
test("Meses cubiertos por adelantos confirmados no crean cargos", async () => {
  const a = await request("/records/advances", "POST", {
    project_id: project.id,
    months: 6,
    start_date: "2026-07-01",
    paid: true,
  });
  assert.equal(a.status, 201);
  assert.equal(
    (
      await request("/billing/generate", "POST", {
        month: "2026-08",
        project_id: project.id,
      })
    ).body.created.length,
    0,
  );
});
test("Tareas y calendario se pueden crear, editar y borrar", async () => {
  for (const [kind, body] of [
    ["tasks", { project_id: project.id, title: "Prueba", status: "todo" }],
    [
      "events",
      {
        project_id: project.id,
        title: "Reunión",
        date: "2026-12-01",
        start_time: "09:00",
        end_time: "10:00",
      },
    ],
  ]) {
    const a = await request("/records/" + kind, "POST", body);
    assert.equal(a.status, 201);
    const b = await request("/records/" + kind + "/" + a.body.id, "PUT", {
      ...a.body,
      title: "Editado",
    });
    assert.equal(b.status, 200);
    assert.equal(
      (
        await request("/records/" + kind + "/" + a.body.id, "DELETE", {
          revision: b.body.revision,
        })
      ).status,
      200,
    );
  }
});
test("Estado JSON, auditoría y exportación sin credenciales", async () => {
  assert.equal((await request("/audit")).status, 200);
  const x = await request("/export");
  assert.equal(x.status, 200);
  assert.equal(x.body.records.projects.length, 6);
  assert.equal(x.body.sessions, undefined);
  assert.equal(x.body.admin, undefined);
  assert.equal(x.body.integrations, undefined);
});
test("Copia SQLite consistente y restauración comprobadas", async () => {
  const env = {
    ...process.env,
    DATA_DIR: dir,
    BACKUP_DIR: join(dir, "backups"),
  };
  const a = spawnSync(process.execPath, ["scripts/backup.mjs"], {
    env,
    encoding: "utf8",
  });
  assert.equal(a.status, 0, a.stderr);
  const file = join(dir, "backups", readdirSync(join(dir, "backups"))[0]);
  const target = join(dir, "restored");
  const r = spawnSync(
    process.execPath,
    ["scripts/restore.mjs", file, "--confirm"],
    { env: { ...env, DATA_DIR: target }, encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr);
});
test("Logout invalida la sesión", async () => {
  assert.equal((await request("/auth/logout", "POST", {})).status, 200);
  assert.equal((await request("/state")).status, 401);
});
