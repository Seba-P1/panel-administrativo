import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  CheckSquare,
  CalendarDays,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Globe,
  Link as LinkIcon,
  FileText,
  LogOut,
  Check,
  Clock,
  AlertCircle,
  X,
  MoreHorizontal,
  Mail,
  ExternalLink,
  Shield,
  Copy,
  Download,
  RefreshCw,
  Menu,
  Trash2,
  Pencil,
  Activity,
  ArrowDownLeft,
  StickyNote,
} from "lucide-react";
import "./style.css";
let csrf = "";
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "No se pudo completar la operación.");
  return data;
}
const phaseNames = {
  active: "En funcionamiento",
  development: "En desarrollo",
  planned: "Por crear",
  demo: "Demo",
  paused: "Pausado",
};
const stateNames = {
  unconfigured: "Por configurar",
  inactive: "No iniciado",
  overdue: "Vencido",
  due: "Próximo pago",
  paid: "Al día",
  review: "Revisar adelanto",
  suspended: "Suspendido",
};
const tasksNames = {
  todo: "Por hacer",
  doing: "En curso",
  review: "Por revisar",
  done: "Hecho",
};
const money = (n, c = "ARS") =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: c,
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
const fmt = (d) =>
  d
    ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Sin confirmar";
const initials = (s) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
function Badge({ state, children }) {
  return (
    <span className={"badge " + state}>
      {children ||
        stateNames[state] ||
        phaseNames[state] ||
        tasksNames[state] ||
        state}
    </span>
  );
}
function Empty({ children = "Todavía no hay registros." }) {
  return (
    <div className="empty">
      <FolderKanban size={24} />
      <p>{children}</p>
    </div>
  );
}
function App() {
  const [auth, setAuth] = useState(null),
    [data, setData] = useState(null),
    [page, setPage] = useState("overview"),
    [selected, setSelected] = useState(null),
    [tab, setTab] = useState("overview"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [currency, setCurrency] = useState("ARS"),
    [mobile, setMobile] = useState(false),
    [connected, setConnected] = useState(false),
    [tokenBox, setTokenBox] = useState(null);
  async function load() {
    try {
      setData(await api("/state"));
    } catch (e) {
      if (e.message.includes("sesión")) setAuth(false);
      else notify(e.message);
    }
  }
  function notify(s) {
    setToast(s);
  }
  useEffect(() => {
    api("/me")
      .then((r) => {
        csrf = r.csrf;
        setAuth(r);
      })
      .catch(() => setAuth(false));
  }, []);
  useEffect(() => {
    if (!auth) return;
    load();
    const source = new EventSource("/api/events/stream");
    source.addEventListener("connected", () => setConnected(true));
    source.addEventListener("change", load);
    source.onerror = () => setConnected(false);
    const timer = setInterval(load, 30000);
    return () => {
      source.close();
      clearInterval(timer);
    };
  }, [auth]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(t);
  }, [toast]);
  if (auth === null) return <div className="loading">Cargando tu espacio…</div>;
  if (!auth)
    return (
      <Login
        onLogin={(r) => {
          csrf = r.csrf;
          setAuth(r);
        }}
      />
    );
  if (!data)
    return <div className="loading">Preparando tus proyectos… {toast}</div>;
  const s = data,
    projects = s.projects.filter((p) => !p.archived),
    clients = s.clients.filter((c) => !c.archived),
    current = s.projects.find((p) => p.id === selected),
    status = current && s.statuses[current.id];
  const filterProject = (p) =>
    !search ||
    [
      p.name,
      p.website,
      p.intermediary,
      s.clients.find((c) => c.id === p.client_id)?.name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  const findProject = (id) =>
    s.projects.find((p) => p.id === id)?.name || "General";
  const openProject = (id) => {
    setSelected(id);
    setTab("overview");
    setPage("project");
    setSearch("");
  };
  const go = (p) => {
    setPage(p);
    setSearch("");
    setMobile(false);
  };
  const edit = (kind, item = {}, preset = {}) =>
    setModal({ kind, item: { ...item, ...preset } });
  async function update(kind, item, patch) {
    try {
      await api(`/records/${kind}/${item.id}`, "PUT", { ...item, ...patch });
      load();
    } catch (e) {
      notify(e.message);
    }
  }
  async function remove(kind, item) {
    if (!confirm("¿Eliminar este registro? Esta acción no se puede deshacer."))
      return;
    try {
      await api(`/records/${kind}/${item.id}`, "DELETE", {
        revision: item.revision,
      });
      load();
      notify("Registro eliminado.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function rotate() {
    if (
      s.integrations.some((i) => i.project_id === current.id) &&
      !confirm("La clave anterior dejará de funcionar. ¿Generar una nueva?")
    )
      return;
    try {
      setTokenBox(await api(`/integrations/${current.id}/rotate`, "POST", {}));
      load();
    } catch (e) {
      notify(e.message);
    }
  }
  async function generate(project_id) {
    setModal({ special: "generate", project_id });
  }
  const overdue = projects.filter((p) =>
    ["overdue", "suspended"].includes(s.statuses[p.id].state),
  );
  const outstanding = s.invoices
    .filter((i) => !i.voided && i.currency === currency)
    .reduce((v, i) => v + balance(i, s.payments), 0);
  const received = s.payments
    .filter(
      (p) =>
        !p.voided &&
        p.currency === currency &&
        p.date.slice(0, 7) === s.today.slice(0, 7),
    )
    .reduce((v, p) => v + p.amount_cents, 0);
  const pageInfo = {
    overview: [
      "Tu estudio, en un solo lugar",
      "Una vista clara de tus clientes, proyectos y próximos pasos.",
    ],
    projects: [
      "Tus proyectos",
      "De la primera demo al próximo cobro. Todo bajo control.",
    ],
    clients: [
      "Clientes y contactos",
      "Relaciones claras, información siempre a mano.",
    ],
    billing: [
      "Cobros y alquileres",
      "Registrá cargos y pagos sin perder el historial.",
    ],
    tasks: [
      "Tu tablero de trabajo",
      "Una cosa menos pendiente, un proyecto más cerca.",
    ],
    calendar: [
      "Calendario",
      "Eventos, vencimientos y tareas, sincronizados entre tus ventanas.",
    ],
    settings: ["Configuración", "Tu espacio, tus reglas."],
    project: [
      current?.name || "Proyecto",
      "Toda la información del proyecto en un mismo lugar.",
    ],
  };
  const projectRecords = (kind) =>
    s[kind].filter((x) => x.project_id === current?.id);
  function finance(project_id) {
    const bills = s.invoices.filter(
        (i) => !project_id || i.project_id === project_id,
      ),
      payments = s.payments.filter(
        (p) => !project_id || p.project_id === project_id,
      ),
      advances = s.advances.filter(
        (a) => !project_id || a.project_id === project_id,
      );
    return (
      <>
        <div className="section-head">
          <div>
            <h2>Cargos del alquiler</h2>
            <p>Los cargos son registros internos, no facturas fiscales.</p>
          </div>
          <div className="actions">
            <button onClick={() => generate(project_id)}>
              <RefreshCw size={15} /> Generar mes
            </button>
            <button
              className="primary"
              onClick={() =>
                edit("invoices", {}, { project_id: project_id || "", currency })
              }
            >
              <Plus size={16} /> Crear cargo
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto / concepto</th>
                <th>Vencimiento</th>
                <th>Importe</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.description}</strong>
                    <small>{findProject(i.project_id)}</small>
                  </td>
                  <td>{fmt(i.due_date)}</td>
                  <td>{money(i.amount_cents, i.currency)}</td>
                  <td>{money(balance(i, s.payments), i.currency)}</td>
                  <td>
                    <Badge
                      state={
                        i.voided
                          ? "paused"
                          : balance(i, s.payments) === 0
                            ? "paid"
                            : i.due_date < s.today
                              ? "overdue"
                              : "due"
                      }
                    >
                      {i.voided ? "Anulado" : undefined}
                    </Badge>
                  </td>
                  <td className="row-actions">
                    <button
                      title="Editar cargo"
                      onClick={() => edit("invoices", i)}
                    >
                      <Pencil size={14} />
                    </button>
                    {!i.voided && balance(i, s.payments) > 0 && (
                      <button
                        onClick={() =>
                          edit(
                            "payments",
                            {},
                            {
                              project_id: i.project_id,
                              invoice_id: i.id,
                              amount_cents: balance(i, s.payments),
                              currency: i.currency,
                              date: s.today,
                            },
                          )
                        }
                      >
                        Cobrar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!bills.length && (
            <Empty>
              Sin cargos registrados. Confirmá tarifa y fecha de inicio antes de
              calcular deudas.
            </Empty>
          )}
        </div>
        <div className="section-head spaced">
          <div>
            <h2>Pagos registrados</h2>
            <p>Se aplican a un cargo concreto y conservan su moneda.</p>
          </div>
          <button
            onClick={() =>
              edit(
                "payments",
                {},
                { project_id: project_id || "", date: s.today, currency },
              )
            }
          >
            <Plus size={15} /> Registrar pago
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Proyecto</th>
                <th>Fecha</th>
                <th>Importe</th>
                <th>Referencia</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{findProject(p.project_id)}</td>
                  <td>{fmt(p.date)}</td>
                  <td>{money(p.amount_cents, p.currency)}</td>
                  <td>{p.reference || p.method || "—"}</td>
                  <td>
                    <Badge state={p.voided ? "paused" : "paid"}>
                      {p.voided ? "Anulado" : "Registrado"}
                    </Badge>
                  </td>
                  <td>
                    <button
                      title="Editar pago"
                      onClick={() => edit("payments", p)}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!payments.length && <Empty>Sin pagos con importe registrado.</Empty>}
        </div>
        <div className="section-head spaced">
          <div>
            <h2>Adelantos por meses</h2>
            <p>
              La cobertura confirmada evita generar el mismo alquiler dos veces.
            </p>
          </div>
          <button
            onClick={() =>
              edit(
                "advances",
                {},
                {
                  project_id: project_id || "",
                  months: 1,
                  paid: true,
                  currency,
                },
              )
            }
          >
            <Plus size={15} /> Adelanto
          </button>
        </div>
        <div className="list-cards">
          {advances.map((a) => (
            <article className="inline-card" key={a.id}>
              <div className="icon-soft">
                <Wallet size={19} />
              </div>
              <div className="grow">
                <strong>
                  {findProject(a.project_id)} · {a.months} meses
                </strong>
                <p>
                  {a.start_date
                    ? `Desde ${fmt(a.start_date)} · renovación ${fmt(addMonthsUI(a.start_date, a.months))}`
                    : "Fecha de inicio y año por confirmar"}{" "}
                  ·{" "}
                  {a.amount_cents === null
                    ? "Importe desconocido"
                    : money(a.amount_cents, a.currency)}
                </p>
                <small>{a.notes}</small>
              </div>
              <Badge
                state={a.voided ? "paused" : a.start_date ? "paid" : "review"}
              >
                {a.voided ? "Anulado" : undefined}
              </Badge>
              <button onClick={() => edit("advances", a)}>
                <Pencil size={15} />
              </button>
            </article>
          ))}
        </div>
        <div className="hint">
          Los adelantos no se suman como ingresos cobrados: registrá también el
          recibo cuando confirmes el importe y su imputación. No dupliques el
          mismo cobro entre períodos. Las deudas previas no se cancelan
          automáticamente.
        </div>
      </>
    );
  }
  function taskBoard(project_id) {
    return (
      <TaskBoard
        tasks={s.tasks.filter(
          (t) =>
            (!project_id || t.project_id === project_id) &&
            (!search || t.title.toLowerCase().includes(search.toLowerCase())),
        )}
        findProject={findProject}
        edit={edit}
        update={update}
        remove={remove}
        project_id={project_id}
      />
    );
  }
  function notes() {
    return (
      <>
        <div className="section-head">
          <h2>Observaciones y notas</h2>
          <button
            className="primary"
            onClick={() => edit("notes", {}, { project_id: current.id })}
          >
            <Plus size={16} /> Nueva nota
          </button>
        </div>
        <div className="note-grid">
          {projectRecords("notes").map((n) => (
            <article className="note" key={n.id}>
              <div className="between">
                <StickyNote size={18} />
                <div className="actions">
                  <button title="Editar nota" onClick={() => edit("notes", n)}>
                    <Pencil size={14} />
                  </button>
                  <button
                    title="Eliminar nota"
                    onClick={() => remove("notes", n)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3>{n.title}</h3>
              <p className="prewrap">{n.body}</p>
              <small>
                Actualizada {new Date(n.updated_at).toLocaleString("es-AR")}
              </small>
            </article>
          ))}
        </div>
        {!projectRecords("notes").length && (
          <Empty>
            Agregá decisiones, observaciones y pendientes importantes.
          </Empty>
        )}
      </>
    );
  }
  return (
    <div className="app-shell">
      <aside className={mobile ? "sidebar visible" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("overview");
          }}
        >
          <span className="brand-mark">
            n<span>↗</span>
          </span>
          <strong>{s.settings.brand}</strong>
          <span className="brand-tag">studio</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">
            {initials(s.settings.owner || "Mi estudio")}
          </span>
          <div>
            <strong>{s.settings.owner || "Mi estudio"}</strong>
            <small>Espacio personal</small>
          </div>
          <Shield size={15} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            [LayoutDashboard, "overview", "Resumen"],
            [FolderKanban, "projects", "Proyectos"],
            [Users, "clients", "Clientes"],
            [Wallet, "billing", "Cobros"],
            [CheckSquare, "tasks", "Tareas"],
            [CalendarDays, "calendar", "Calendario"],
          ].map(([Icon, key, label]) => (
            <button
              className={
                page === key || (key === "projects" && page === "project")
                  ? "nav-item active"
                  : "nav-item"
              }
              onClick={() => go(key)}
              key={key}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === "projects" && <em>{projects.length}</em>}
              {key === "tasks" && (
                <i>{s.tasks.filter((t) => t.status !== "done").length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="live-dot" />
            <strong>Tu operación, conectada.</strong>
            <p>Cada proyecto tiene su propio espacio e historial.</p>
            <button onClick={() => go("projects")}>
              Ver proyectos <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className={"nav-item " + (page === "settings" ? "active" : "")}
            onClick={() => go("settings")}
          >
            <Settings size={18} /> Configuración
          </button>
          <button
            className="nav-item"
            onClick={async () => {
              await api("/auth/logout", "POST", {});
              setAuth(false);
            }}
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
          <div className="user-chip">
            <span className="avatar">
              {initials(s.settings.owner || "Mi estudio")}
            </span>
            <div>
              <strong>Administrador</strong>
              <small>{auth.email}</small>
            </div>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="actions">
            <button
              className="mobile-toggle"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {page === "project" ? "Proyectos" : pageInfo[page][0]}
              </strong>
            </span>
          </div>
          <div className="top-actions">
            <span className="sync">
              <i className={connected ? "online" : ""} />
              {connected ? "En vivo" : "Reconectando"}
            </span>
            <span className="date-chip">{fmt(s.today)}</span>
            <span className="avatar">
              {initials(s.settings.owner || "Mi estudio")}
            </span>
          </div>
        </header>
        <div className="page-content">
          <section className="page-title">
            <div>
              {page === "overview" && (
                <div className="eyebrow">TU CENTRO DE OPERACIONES</div>
              )}
              {page === "project" && (
                <button className="back" onClick={() => go("projects")}>
                  <ArrowLeft size={14} /> Todos los proyectos
                </button>
              )}
              <h1>
                {page === "overview"
                  ? `Hola, ${s.settings.owner === "Mi estudio" ? "bienvenido" : s.settings.owner}.`
                  : pageInfo[page][0]}
                {page === "overview" && (
                  <span className="greeting-dot">✳</span>
                )}
              </h1>
              <p>{pageInfo[page][1]}</p>
            </div>
            <div className="actions">
              {["overview", "projects"].includes(page) && (
                <button className="primary" onClick={() => edit("projects")}>
                  <Plus size={17} /> Nuevo proyecto
                </button>
              )}
              {page === "clients" && (
                <button className="primary" onClick={() => edit("clients")}>
                  <Plus size={17} /> Nuevo cliente
                </button>
              )}
              {page === "project" && current && (
                <button onClick={() => edit("projects", current)}>
                  <Pencil size={16} /> Editar proyecto
                </button>
              )}
            </div>
          </section>
          {["overview", "projects", "clients", "tasks"].includes(page) && (
            <div className="toolbar">
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="Buscar"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    page === "clients"
                      ? "Buscar clientes…"
                      : page === "tasks"
                        ? "Buscar tareas…"
                        : "Buscar proyecto, cliente o sitio web…"
                  }
                />
                {search && (
                  <button onClick={() => setSearch("")}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                aria-label="Moneda de los indicadores"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option>ARS</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>
          )}
          {page === "overview" && (
            <>
              <div className="stats-grid">
                <article className="stat dark">
                  <div>
                    <span>Proyectos activos</span>
                    <FolderKanban size={18} />
                  </div>
                  <strong>
                    {projects.filter((p) => p.phase === "active").length}
                    <small> / {projects.length}</small>
                  </strong>
                  <p>
                    <span className="mini-dot" />{" "}
                    {projects.filter((p) => p.phase !== "active").length} en
                    desarrollo, demo o preparación
                  </p>
                  <div className="stat-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </article>
                <article className="stat">
                  <div>
                    <span>Cobrado este mes</span>
                    <ArrowDownLeft size={18} />
                  </div>
                  <strong>{money(received, currency)}</strong>
                  <p>Pagos con importe registrado · {currency}</p>
                  <div className="stat-foot">
                    <Badge state="paid">Ingresos reales</Badge>
                  </div>
                </article>
                <article className="stat">
                  <div>
                    <span>Saldo de cargos</span>
                    <Wallet size={18} />
                  </div>
                  <strong>{money(outstanding, currency)}</strong>
                  <p>Incluye pendientes y vencidos · {currency}</p>
                  <div className="stat-foot">
                    <span>
                      {overdue.length} proyecto(s) con mora o suspensión
                    </span>
                  </div>
                </article>
                <article className="stat accent">
                  <div>
                    <span>Pendientes de trabajo</span>
                    <CheckSquare size={18} />
                  </div>
                  <strong>
                    {s.tasks.filter((t) => t.status !== "done").length}
                    <small> tareas</small>
                  </strong>
                  <p>
                    {s.tasks.filter((t) => t.status === "review").length} por
                    revisar ·{" "}
                    {s.tasks.filter((t) => t.status === "done").length} hechas
                  </p>
                  <button onClick={() => go("tasks")}>
                    Abrir tablero <ArrowUpRight size={16} />
                  </button>
                </article>
              </div>
              <div className="overview-middle">
                <section className="panel">
                  <div className="section-head">
                    <div>
                      <h2>Ingresos registrados</h2>
                      <p>
                        Últimos seis meses · {currency} · sin adelantos de
                        importe desconocido
                      </p>
                    </div>
                    <span className="small-label">PAGOS</span>
                  </div>
                  <IncomeChart
                    payments={s.payments}
                    currency={currency}
                    date={s.today}
                  />
                </section>
                <section className="panel attention">
                  <div className="section-head">
                    <div>
                      <h2>Necesitan tu atención</h2>
                      <p>Confirmaciones antes de cobrar</p>
                    </div>
                    <span className="icon-soft">
                      <AlertCircle size={19} />
                    </span>
                  </div>
                  {projects
                    .filter((p) =>
                      [
                        "unconfigured",
                        "review",
                        "overdue",
                        "suspended",
                      ].includes(s.statuses[p.id].state),
                    )
                    .slice(0, 4)
                    .map((p) => (
                      <button
                        className="attention-item"
                        onClick={() => openProject(p.id)}
                        key={p.id}
                      >
                        <span className="project-avatar orange">
                          {initials(p.name)}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{stateNames[s.statuses[p.id].state]}</small>
                        </span>
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  {!projects.some((p) =>
                    ["unconfigured", "review", "overdue", "suspended"].includes(
                      s.statuses[p.id].state,
                    ),
                  ) && <p className="muted">Sin alertas pendientes.</p>}
                  <div className="subtle-note">
                    No se calcula deuda sin cargos y fechas confirmadas.
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="section-head">
                  <div>
                    <h2>
                      Tu cartera de proyectos{" "}
                      <span className="count">{projects.length}</span>
                    </h2>
                    <p>Una mirada rápida a cada relación.</p>
                  </div>
                  <button className="text-btn" onClick={() => go("projects")}>
                    Ver todos <ArrowUpRight size={16} />
                  </button>
                </div>
                <ProjectTable
                  projects={projects.filter(filterProject)}
                  s={s}
                  open={openProject}
                />
              </section>
              <div className="overview-bottom">
                <section className="panel">
                  <div className="section-head">
                    <h2>Próximos pasos</h2>
                    <button className="text-btn" onClick={() => go("tasks")}>
                      Ir al tablero <ArrowUpRight size={16} />
                    </button>
                  </div>
                  {s.tasks
                    .filter((t) => t.status !== "done")
                    .slice(0, 5)
                    .map((t) => (
                      <div className="todo-line" key={t.id}>
                        <button
                          className="check-button"
                          title="Marcar hecha"
                          onClick={() => update("tasks", t, { status: "done" })}
                        >
                          <Check size={13} />
                        </button>
                        <div className="grow">
                          <strong onClick={() => edit("tasks", t)}>
                            {t.title}
                          </strong>
                          <small>{findProject(t.project_id)}</small>
                        </div>
                        <Badge
                          state={t.priority === "high" ? "overdue" : "todo"}
                        >
                          {t.priority === "high" ? "Alta" : "Normal"}
                        </Badge>
                      </div>
                    ))}
                </section>
                <section className="panel">
                  <div className="section-head">
                    <h2>Agenda cercana</h2>
                    <button className="text-btn" onClick={() => go("calendar")}>
                      <CalendarDays size={17} />
                    </button>
                  </div>
                  {s.events
                    .filter((e) => e.date >= s.today)
                    .sort(
                      (a, b) =>
                        a.date.localeCompare(b.date) ||
                        a.start_time.localeCompare(b.start_time),
                    )
                    .slice(0, 4)
                    .map((e) => (
                      <div
                        className="agenda-line"
                        key={e.id}
                        onClick={() => edit("events", e)}
                      >
                        <div className="agenda-date">
                          {e.date.slice(8)}
                          <small>
                            {new Date(e.date + "T12:00:00").toLocaleString(
                              "es-AR",
                              { month: "short" },
                            )}
                          </small>
                        </div>
                        <div>
                          <strong>{e.title}</strong>
                          <small>
                            {e.start_time} · {findProject(e.project_id)}
                          </small>
                        </div>
                      </div>
                    ))}
                  {!s.events.some((e) => e.date >= s.today) && (
                    <Empty>
                      No hay eventos próximos. Tu agenda está lista para
                      empezar.
                    </Empty>
                  )}
                  <button
                    className="wide"
                    onClick={() =>
                      edit(
                        "events",
                        {},
                        {
                          date: s.today,
                          start_time: "09:00",
                          end_time: "10:00",
                        },
                      )
                    }
                  >
                    <Plus size={16} /> Agendar evento
                  </button>
                </section>
              </div>
            </>
          )}
          {page === "projects" && (
            <>
              <div className="project-grid">
                {projects.filter(filterProject).map((p, i) => (
                  <article className="project-card" key={p.id}>
                    <div className="between">
                      <div className={"project-avatar color-" + (i % 4)}>
                        {initials(p.name)}
                      </div>
                      <Badge state={p.phase} />
                    </div>
                    <h2>
                      <button
                        className="plain"
                        onClick={() => openProject(p.id)}
                      >
                        {p.name}
                      </button>
                    </h2>
                    <p className="muted">
                      {s.clients.find((c) => c.id === p.client_id)?.name ||
                        "Sin cliente asignado"}
                    </p>
                    <a
                      href={p.website || undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="website"
                    >
                      <Globe size={14} />
                      {p.website
                        ? new URL(p.website).hostname
                        : "Sitio todavía no definido"}
                    </a>
                    <div className="project-card-bottom">
                      <Badge state={s.statuses[p.id].state} />
                      <button
                        title="Abrir proyecto"
                        onClick={() => openProject(p.id)}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <ArchivedList
                records={s.projects.filter((p) => p.archived)}
                restore={(p) => update("projects", p, { archived: false })}
              />
            </>
          )}
          {page === "clients" && (
            <section className="panel">
              <div className="section-head">
                <h2>
                  Directorio <span className="count">{clients.length}</span>
                </h2>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Contacto</th>
                      <th>Proyectos</th>
                      <th>Observaciones</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients
                      .filter(
                        (c) =>
                          !search ||
                          [c.name, c.company, c.email]
                            .join(" ")
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div className="table-person">
                              <span className="project-avatar">
                                {initials(c.name)}
                              </span>
                              <div>
                                <strong>{c.name}</strong>
                                <small>{c.company}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {c.email || "Email pendiente"}
                            <small>{c.phone || "Teléfono pendiente"}</small>
                          </td>
                          <td>
                            {projects
                              .filter((p) => p.client_id === c.id)
                              .map((p) => (
                                <button
                                  className="tiny-link"
                                  onClick={() => openProject(p.id)}
                                  key={p.id}
                                >
                                  {p.name}
                                </button>
                              ))}
                          </td>
                          <td>
                            <span className="truncate">{c.notes || "—"}</span>
                          </td>
                          <td>
                            <button onClick={() => edit("clients", c)}>
                              <Pencil size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <ArchivedList
                records={s.clients.filter((c) => c.archived)}
                restore={(c) => update("clients", c, { archived: false })}
              />
            </section>
          )}
          {page === "billing" && (
            <section className="panel">{finance()}</section>
          )}
          {page === "tasks" && taskBoard()}
          {page === "calendar" && (
            <Calendar
              s={s}
              edit={edit}
              update={update}
              findProject={findProject}
              remove={remove}
            />
          )}
          {page === "project" && current && (
            <>
              <div className="project-summary">
                <div className="project-avatar large">
                  {initials(current.name)}
                </div>
                <div className="grow">
                  <div className="actions">
                    <Badge state={current.phase} />
                    <Badge state={status.state} />
                  </div>
                  <p>
                    {s.clients.find((c) => c.id === current.client_id)?.name ||
                      "Cliente no asignado"}
                    {current.intermediary &&
                      ` · Intermediario: ${current.intermediary}`}
                  </p>
                </div>
                {current.website && (
                  <a
                    className="button"
                    href={current.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Globe size={16} /> Sitio web <ExternalLink size={13} />
                  </a>
                )}
                {current.admin_url && (
                  <a
                    className="button"
                    href={current.admin_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Shield size={16} /> Abrir panel <ExternalLink size={13} />
                  </a>
                )}
              </div>
              <div className={"status-banner " + status.state}>
                <AlertCircle size={18} />
                <div>
                  <strong>{stateNames[status.state]}</strong>
                  <p>
                    {status.message}{" "}
                    {status.days_to_due !== null && status.days_to_due < 0
                      ? `${-status.days_to_due} días desde el primer vencimiento pendiente.`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="tabs">
                {[
                  ["overview", "Información"],
                  ["billing", "Cobros"],
                  ["notes", "Notas"],
                  ["tasks", "Tareas"],
                  ["calendar", "Calendario"],
                  ["connections", "Conexión"],
                  ["messages", "Mensajes"],
                ].map(([k, n]) => (
                  <button
                    className={tab === k ? "selected" : ""}
                    onClick={() => setTab(k)}
                    key={k}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <section
                className={["tasks", "calendar"].includes(tab) ? "" : "panel"}
              >
                {tab === "overview" && (
                  <>
                    <div className="section-head">
                      <h2>Ficha del proyecto</h2>
                      <button onClick={() => edit("projects", current)}>
                        <Pencil size={15} /> Editar información
                      </button>
                    </div>
                    <div className="info-grid">
                      {[
                        [
                          "Cliente",
                          s.clients.find((c) => c.id === current.client_id)
                            ?.name || "Por confirmar",
                        ],
                        [
                          "Intermediario",
                          current.intermediary || "Sin intermediario",
                        ],
                        [
                          "Tarifa mensual",
                          current.monthly_cents
                            ? money(current.monthly_cents, current.currency)
                            : "Sin confirmar",
                        ],
                        ["Inicio del alquiler", fmt(current.billing_start)],
                        [
                          "Gestión del alquiler",
                          current.billing_enabled
                            ? "Habilitada"
                            : "Desactivada",
                        ],
                        [
                          "Suspensión automática",
                          current.auto_suspend
                            ? "Activada: requiere integración instalada"
                            : "Desactivada",
                        ],
                        ["Días de gracia", `${current.grace_days} días`],
                        ["Aviso previo", `${current.warning_days} días antes`],
                        [
                          "Hosting / despliegue",
                          current.hosting || "Sin registrar",
                        ],
                        ["Repositorio", current.repository || "Sin registrar"],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <small>{k}</small>
                          <strong>{v}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="description">
                      <h3>Observaciones generales</h3>
                      <p className="prewrap">
                        {current.description ||
                          "Agregá información, acuerdos y detalles del proyecto."}
                      </p>
                    </div>
                    <div className="hint">
                      Las claves de acceso a otros sistemas no se guardan aquí.
                      Abrir un enlace al panel no equivale a integrarlo.
                    </div>
                    <div className="actions spaced">
                      <button
                        onClick={() =>
                          edit(
                            "clients",
                            s.clients.find((c) => c.id === current.client_id) ||
                              {},
                          )
                        }
                      >
                        <Users size={15} /> Editar cliente
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (
                            confirm(
                              "Archivar no suspende el sitio ni elimina datos. Revocá antes el conector si corresponde. ¿Continuar?",
                            )
                          )
                            update("projects", current, {
                              archived: !current.archived,
                            });
                        }}
                      >
                        {current.archived
                          ? "Restaurar proyecto"
                          : "Archivar proyecto"}
                      </button>
                    </div>
                  </>
                )}
                {tab === "billing" && finance(current.id)}
                {tab === "notes" && notes()}
                {tab === "tasks" && taskBoard(current.id)}
                {tab === "calendar" && (
                  <Calendar
                    s={s}
                    edit={edit}
                    update={update}
                    findProject={findProject}
                    project_id={current.id}
                    remove={remove}
                  />
                )}
                {tab === "connections" && (
                  <>
                    <div className="section-head">
                      <div>
                        <h2>Conectar el panel administrativo</h2>
                        <p>
                          API privada · credencial exclusiva para este proyecto
                        </p>
                      </div>
                      <LinkIcon size={22} />
                    </div>
                    <div className="connection-box">
                      <span className="icon-soft">
                        <Shield size={26} />
                      </span>
                      <h3>
                        {s.integrations.some((i) => i.project_id === current.id)
                          ? "Credencial emitida"
                          : "Todavía no conectado"}
                      </h3>
                      <p>
                        {s.integrations.find((i) => i.project_id === current.id)
                          ?.last_seen
                          ? `Última consulta del conector: ${new Date(s.integrations.find((i) => i.project_id === current.id).last_seen).toLocaleString("es-AR")}`
                          : "Todavía no se recibió una consulta del conector. Emitir una clave no prueba que esté instalado."}
                      </p>
                      <div className="actions">
                        <button className="primary" onClick={rotate}>
                          {s.integrations.some(
                            (i) => i.project_id === current.id,
                          )
                            ? "Rotar credencial"
                            : "Generar credencial"}
                        </button>
                        {s.integrations.some(
                          (i) => i.project_id === current.id,
                        ) && (
                          <button
                            className="danger"
                            onClick={async () => {
                              if (
                                !confirm(
                                  "¿Revocar la credencial? El sitio dejará de consultar esta API.",
                                )
                              )
                                return;
                              try {
                                await api(
                                  `/integrations/${current.id}`,
                                  "DELETE",
                                  {},
                                );
                                load();
                              } catch (e) {
                                notify(e.message);
                              }
                            }}
                          >
                            Revocar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="hint">
                      <strong>
                        Instalación necesaria en el código del proyecto.
                      </strong>{" "}
                      Incluí el conector de la carpeta integrations/nextjs. La
                      clave va únicamente en el servidor, nunca en variables
                      NEXT_PUBLIC_ ni VITE_. Los avisos y el bloqueo deben
                      aplicarse también a cada API administrativa. El sitio
                      público no se bloquea.
                    </div>
                    <div className="info-grid">
                      <div>
                        <small>ID de proyecto</small>
                        <code>{current.id}</code>
                      </div>
                      <div>
                        <small>Política si el servidor no responde</small>
                        <strong>Permitir acceso y advertir al operador</strong>
                      </div>
                    </div>
                  </>
                )}
                {tab === "messages" && (
                  <>
                    <div className="section-head">
                      <div>
                        <h2>Mensajes al cliente</h2>
                        <p>
                          {s.email_ready
                            ? "SMTP configurado: podés enviar email desde aquí."
                            : "Sin SMTP: prepará un borrador de email o WhatsApp."}
                        </p>
                      </div>
                      <button
                        className="primary"
                        onClick={() =>
                          edit(
                            "messages",
                            {},
                            {
                              project_id: current.id,
                              channel: "email",
                              recipient:
                                s.clients.find(
                                  (c) => c.id === current.client_id,
                                )?.email || "",
                              subject: `Información de ${current.name}`,
                              body: status.message,
                              status: "draft",
                            },
                          )
                        }
                      >
                        <Plus size={16} /> Nuevo mensaje
                      </button>
                    </div>
                    {projectRecords("messages").map((m) => (
                      <article className="message-card" key={m.id}>
                        <div className="between">
                          <h3>{m.subject}</h3>
                          <Badge
                            state={
                              m.status === "sent"
                                ? "paid"
                                : m.status === "failed"
                                  ? "overdue"
                                  : "review"
                            }
                          >
                            {m.status === "sent"
                              ? "Envío registrado"
                              : m.status === "failed"
                                ? "Falló"
                                : "Borrador"}
                          </Badge>
                        </div>
                        <small>
                          {m.channel} · {m.recipient || "Sin destinatario"}
                        </small>
                        <p className="prewrap">{m.body}</p>
                        <div className="actions">
                          <button onClick={() => edit("messages", m)}>
                            <Pencil size={14} /> Editar
                          </button>
                          {m.channel === "email" && (
                            <>
                              <a
                                className="button"
                                href={`mailto:${encodeURIComponent(m.recipient)}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}
                              >
                                <ExternalLink size={14} /> Abrir correo
                              </a>
                              {s.email_ready && m.status !== "sent" && (
                                <button
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `¿Enviar email a ${m.recipient}?`,
                                      )
                                    )
                                      return;
                                    try {
                                      const r = await api(
                                        `/messages/${m.id}/send`,
                                        "POST",
                                        {},
                                      );
                                      load();
                                      notify(r.message);
                                    } catch (e) {
                                      notify(e.message);
                                      load();
                                    }
                                  }}
                                >
                                  <Mail size={14} /> Enviar por SMTP
                                </button>
                              )}
                            </>
                          )}
                          {m.channel === "whatsapp" && (
                            <a
                              className="button"
                              target="_blank"
                              rel="noreferrer"
                              href={`https://wa.me/${m.recipient.replace(/\D/g, "")}?text=${encodeURIComponent(m.subject + "\n\n" + m.body)}`}
                            >
                              <ExternalLink size={14} /> Abrir WhatsApp
                            </a>
                          )}
                          {m.status !== "sent" && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    "Marcá esto solo si verificaste el envío por fuera del panel. ¿Confirmar?",
                                  )
                                )
                                  update("messages", m, { status: "sent" });
                              }}
                            >
                              Confirmar envío externo
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                    {!projectRecords("messages").length && (
                      <Empty>
                        Sin mensajes registrados. No se envía nada sin tu
                        acción.
                      </Empty>
                    )}
                    <div className="hint">
                      Abrir WhatsApp o el correo solo crea un borrador: todavía
                      debés enviarlo. SMTP aceptado no garantiza entrega. Editá
                      y verificá los importes antes de enviar.
                    </div>
                  </>
                )}
              </section>
            </>
          )}
          {page === "settings" && (
            <SettingsPage
              s={s}
              notify={notify}
              load={load}
              onLogout={() => setAuth(false)}
            />
          )}
          <footer>
            <span>{s.settings.brand} · Tu centro de operaciones</span>
            <span>Datos privados · {s.settings.timezone}</span>
          </footer>
        </div>
      </main>
      {modal && (
        <Editor
          modal={modal}
          s={s}
          close={() => setModal(null)}
          saved={() => {
            load();
            setModal(null);
            notify("Cambios guardados.");
          }}
          notify={notify}
        />
      )}
      {tokenBox && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="section-head">
              <h2>Guardá esta credencial</h2>
              <button onClick={() => setTokenBox(null)}>
                <X size={18} />
              </button>
            </div>
            <p>
              Se muestra una sola vez. Copiala al entorno del servidor del
              proyecto. Rotarla invalida la anterior.
            </p>
            <label>
              Endpoint<code className="codebox">{tokenBox.endpoint}</code>
            </label>
            <label>
              Token secreto<code className="codebox">{tokenBox.token}</code>
            </label>
            <button
              className="primary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(tokenBox.token);
                  notify("Credencial copiada.");
                } catch {
                  notify("Seleccioná y copiá la credencial manualmente.");
                }
              }}
            >
              <Copy size={16} /> Copiar token
            </button>
          </section>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <AlertCircle size={18} />
          {toast}
          <button onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function balance(i, payments) {
  return i.voided
    ? 0
    : Math.max(
        0,
        i.amount_cents -
          payments
            .filter((p) => !p.voided && p.invoice_id === i.id)
            .reduce((s, p) => s + p.amount_cents, 0),
      );
}
function addMonthsUI(d, n) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(
    Date.UTC(
      y,
      m - 1 + n,
      Math.min(day, new Date(Date.UTC(y, m + n, 0)).getUTCDate()),
      12,
    ),
  )
    .toISOString()
    .slice(0, 10);
}
function ArchivedList({ records, restore }) {
  return (
    records.length > 0 && (
      <details className="archived">
        <summary>Archivados ({records.length})</summary>
        {records.map((r) => (
          <div className="between" key={r.id}>
            <span>{r.name}</span>
            <button onClick={() => restore(r)}>Restaurar</button>
          </div>
        ))}
      </details>
    )
  );
}
function ProjectTable({ projects, s, open }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Cliente / intermediario</th>
            <th>Etapa</th>
            <th>Alquiler</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p, i) => (
            <tr key={p.id} onClick={() => open(p.id)} className="clickable">
              <td>
                <div className="table-person">
                  <span className={"project-avatar color-" + (i % 4)}>
                    {initials(p.name)}
                  </span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.website
                        ? new URL(p.website).hostname
                        : "Sitio por definir"}
                    </small>
                  </div>
                </div>
              </td>
              <td>
                {s.clients.find((c) => c.id === p.client_id)?.name ||
                  "Por asignar"}
                <small>{p.intermediary || "Contacto directo"}</small>
              </td>
              <td>
                <Badge state={p.phase} />
              </td>
              <td>
                <Badge state={s.statuses[p.id].state} />
              </td>
              <td>
                <ArrowUpRight size={16} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!projects.length && <Empty>No se encontraron proyectos.</Empty>}
    </div>
  );
}
function IncomeChart({ payments, currency, date }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(1);
    d.setMonth(d.getMonth() - 5 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return {
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      total: payments
        .filter(
          (p) => !p.voided && p.currency === currency && p.date.startsWith(key),
        )
        .reduce((n, p) => n + p.amount_cents, 0),
    };
  });
  const max = Math.max(...months.map((m) => m.total), 100);
  return (
    <div className="chart">
      <div className="chart-y">
        {[1, 0.75, 0.5, 0.25, 0].map((n) => (
          <span key={n}>{money(Math.round(max * n), currency)}</span>
        ))}
      </div>
      <div className="chart-plot">
        <div className="grid-lines">
          {[0, 1, 2, 3, 4].map((n) => (
            <i key={n} />
          ))}
        </div>
        <div className="chart-bars">
          {months.map((m, i) => (
            <div className="chart-bar" key={m.label}>
              <div
                title={money(m.total, currency)}
                className={"bar " + (i === 5 ? "highlight" : "")}
                style={{
                  height: m.total
                    ? Math.max(3, (m.total / max) * 145) + "px"
                    : "2px",
                }}
              />
              <span>{m.label}</span>
            </div>
          ))}
        </div>
        {months.every((m) => !m.total) && (
          <div className="chart-empty">Tu primer pago aparecerá acá.</div>
        )}
      </div>
    </div>
  );
}
function TaskBoard({ tasks, findProject, edit, update, remove, project_id }) {
  return (
    <>
      <div className="section-head">
        <p className="muted">Arrastrá las tarjetas para cambiar de etapa.</p>
        <button
          className="primary"
          onClick={() =>
            edit(
              "tasks",
              {},
              {
                project_id: project_id || "",
                status: "todo",
                priority: "normal",
              },
            )
          }
        >
          <Plus size={16} /> Nueva tarea
        </button>
      </div>
      <div className="kanban">
        {Object.entries(tasksNames).map(([key, label]) => (
          <section
            className={"kanban-column " + key}
            key={key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const t = tasks.find(
                (t) => t.id === e.dataTransfer.getData("task"),
              );
              if (t) update("tasks", t, { status: key });
            }}
          >
            <div className="kanban-title">
              <span>
                <i />
                {label}
              </span>
              <em>{tasks.filter((t) => t.status === key).length}</em>
              <button
                title="Agregar tarea"
                onClick={() =>
                  edit(
                    "tasks",
                    {},
                    {
                      project_id: project_id || "",
                      status: key,
                      priority: "normal",
                    },
                  )
                }
              >
                <Plus size={15} />
              </button>
            </div>
            {tasks
              .filter((t) => t.status === key)
              .map((t) => (
                <article
                  className="task-card"
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("task", t.id)}
                >
                  <div className="between">
                    <span className={"priority " + t.priority}>
                      {t.priority === "high"
                        ? "Alta prioridad"
                        : t.priority === "low"
                          ? "Baja"
                          : "Normal"}
                    </span>
                    <button
                      title="Editar tarea"
                      onClick={() => edit("tasks", t)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <h3 onClick={() => edit("tasks", t)}>{t.title}</h3>
                  <p>{t.description}</p>
                  <small>{findProject(t.project_id)}</small>
                  <div className="task-bottom">
                    <span>
                      <CalendarDays size={13} />
                      {t.due_date ? fmt(t.due_date) : "Sin fecha"}
                    </span>
                    <button
                      title="Eliminar tarea"
                      onClick={() => remove("tasks", t)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
function Calendar({ s, edit, update, findProject, project_id, remove }) {
  const [month, setMonth] = useState(s.today.slice(0, 7));
  const first = new Date(month + "-01T12:00:00");
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + days) / 7) * 7 },
    (_, i) => {
      const d = new Date(first);
      d.setDate(i - offset + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    },
  );
  const events = s.events.filter(
    (e) => !project_id || e.project_id === project_id,
  );
  function shift(n) {
    const d = new Date(first);
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return (
    <section className="panel">
      <div className="section-head calendar-head">
        <div className="actions">
          <button title="Mes anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={17} />
          </button>
          <h2>
            {first.toLocaleString("es-AR", { month: "long", year: "numeric" })}
          </h2>
          <button title="Mes siguiente" onClick={() => shift(1)}>
            <ChevronRight size={17} />
          </button>
        </div>
        <div className="actions">
          <button onClick={() => setMonth(s.today.slice(0, 7))}>Hoy</button>
          <button
            className="primary"
            onClick={() =>
              edit(
                "events",
                {},
                {
                  project_id: project_id || "",
                  date: s.today,
                  start_time: "09:00",
                  end_time: "10:00",
                },
              )
            }
          >
            <Plus size={16} /> Evento
          </button>
        </div>
      </div>
      <p className="muted small">
        Horario: {s.settings.timezone}. Hacé clic en un día para agendar;
        arrastrá un evento para moverlo. No sincroniza Google/Outlook.
      </p>
      <div className="calendar-scroll">
        <div className="calendar-grid">
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div className="day-label" key={d}>
              {d}
            </div>
          ))}
          {cells.map((d) => (
            <div
              className={
                "calendar-day " +
                (!d.startsWith(month) ? "outside " : "") +
                (d === s.today ? "today" : "")
              }
              key={d}
              onClick={() =>
                edit(
                  "events",
                  {},
                  {
                    project_id: project_id || "",
                    date: d,
                    start_time: "09:00",
                    end_time: "10:00",
                  },
                )
              }
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const ev = events.find(
                  (v) => v.id === e.dataTransfer.getData("event"),
                );
                if (ev) update("events", ev, { date: d });
              }}
            >
              <span className="day-number">{Number(d.slice(8))}</span>
              {events
                .filter((e) => e.date === d)
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((e) => (
                  <button
                    title={findProject(e.project_id) + " · " + e.description}
                    className="calendar-event"
                    key={e.id}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("event", e.id)
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      edit("events", e);
                    }}
                  >
                    {e.start_time} {e.title}
                  </button>
                ))}
              {s.invoices
                .filter(
                  (i) =>
                    !i.voided &&
                    i.due_date === d &&
                    balance(i, s.payments) > 0 &&
                    (!project_id || i.project_id === project_id),
                )
                .map((i) => (
                  <button
                    className="calendar-event invoice"
                    key={i.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      edit("invoices", i);
                    }}
                  >
                    Vence · {findProject(i.project_id)}
                  </button>
                ))}
              {s.tasks
                .filter(
                  (t) =>
                    t.status !== "done" &&
                    t.due_date === d &&
                    (!project_id || t.project_id === project_id),
                )
                .map((t) => (
                  <button
                    className="calendar-event task"
                    key={t.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      edit("tasks", t);
                    }}
                  >
                    Tarea · {t.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
      <div className="legend">
        <span>
          <i /> Evento
        </span>
        <span>
          <i className="invoice" /> Vencimiento
        </span>
        <span>
          <i className="task" /> Tarea
        </span>
      </div>
    </section>
  );
}
function Login({ onLogin }) {
  const [setup, setSetup] = useState(null),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/auth/state")
      .then((r) => setSetup(r.needs_setup))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="login-page">
      <div className="login-art">
        <span className="brand-mark">n↗</span>
        <p className="eyebrow">TU ESTUDIO. MÁS SIMPLE.</p>
        <h1>
          Grandes proyectos.
          <br />
          Todo en su lugar.
        </h1>
        <p>
          Clientes, alquileres y próximos pasos.
          <br />
          Un espacio diseñado para tu trabajo.
        </p>
        <div className="login-orbit">
          <div />
          <span>nexo.</span>
          <i />
          <b />
        </div>
        <small>Instancia privada · Sin credenciales predeterminadas</small>
      </div>
      <form
        className="login-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (setup) {
              await api("/auth/setup", "POST", {
                email,
                password,
                setup_token: code,
              });
              setSetup(false);
              setCode("");
            }
            onLogin(await api("/auth/login", "POST", { email, password }));
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="icon-soft">
          <Shield size={24} />
        </div>
        <h2>{setup ? "Creá tu cuenta privada" : "Bienvenido de nuevo"}</h2>
        <p>
          {setup
            ? "Usá el código generado al ejecutar npm run init."
            : "Ingresá para administrar tus proyectos."}
        </p>
        {setup && (
          <label>
            Código de instalación
            <input
              type="password"
              required
              minLength={32}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            minLength={setup ? 12 : 1}
            maxLength={200}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={setup ? "new-password" : "current-password"}
          />
        </label>
        {setup && (
          <small>
            Mínimo 12 caracteres. Guardala en un gestor de contraseñas.
          </small>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="primary wide" disabled={busy || setup === null}>
          {busy ? "Ingresando…" : setup ? "Crear cuenta y entrar" : "Ingresar"}
          <ArrowUpRight size={17} />
        </button>
        <small>No publiques el archivo .env ni una copia de tu base.</small>
      </form>
    </div>
  );
}
function Editor({ modal, s, close, saved, notify }) {
  const kind = modal.kind,
    item = modal.item || {};
  const [values, setValues] = useState(() => ({ ...item })),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const fields = useMemo(() => {
    const projects = [
      ["", "General / sin asignar"],
      ...s.projects.map((p) => [
        p.id,
        p.name + (p.archived ? " (archivado)" : ""),
      ]),
    ];
    const project = ["project_id", "Proyecto", "select", projects];
    const base = {
      clients: [
        ["name", "Nombre o razón social", "text", true],
        ["company", "Organización"],
        ["email", "Email", "email"],
        ["phone", "Teléfono con código de país"],
        ["notes", "Observaciones", "textarea"],
        ["archived", "Archivado", "checkbox"],
      ],
      projects: [
        ["name", "Nombre del proyecto", "text", true],
        [
          "client_id",
          "Cliente",
          "select",
          [["", "Sin asignar"], ...s.clients.map((c) => [c.id, c.name])],
        ],
        ["phase", "Etapa", "select", Object.entries(phaseNames)],
        ["website", "Sitio web", "url"],
        ["admin_url", "URL del panel administrativo", "url"],
        ["repository", "Repositorio", "url"],
        ["hosting", "Hosting / servidor"],
        ["intermediary", "Intermediario"],
        ["description", "Observaciones", "textarea"],
        ["monthly_cents", "Tarifa mensual", "money"],
        [
          "currency",
          "Moneda",
          "select",
          ["ARS", "USD", "EUR"].map((c) => [c, c]),
        ],
        ["billing_start", "Inicio confirmado del alquiler", "date"],
        ["billing_enabled", "Habilitar gestión del alquiler", "checkbox"],
        ["warning_days", "Días de aviso previo", "number"],
        ["grace_days", "Días de gracia después del vencimiento", "number"],
        [
          "policy_accepted",
          "La política de suspensión fue acordada con el cliente",
          "checkbox",
        ],
        [
          "auto_suspend",
          "Suspender panel automáticamente por mora",
          "checkbox",
        ],
        [
          "manual_suspended",
          "Suspender acceso administrativo manualmente",
          "checkbox",
        ],
        ["suspension_reason", "Motivo de suspensión", "textarea"],
        ["archived", "Archivar proyecto (no suspende ni elimina)", "checkbox"],
      ],
      invoices: [
        project,
        ["description", "Concepto", "text", true],
        ["amount_cents", "Importe", "money", true],
        [
          "currency",
          "Moneda",
          "select",
          ["ARS", "USD", "EUR"].map((c) => [c, c]),
        ],
        ["due_date", "Vencimiento", "date", true],
        ["period", "Inicio del período (evita duplicados)", "date"],
        ["notes", "Notas", "textarea"],
        ["voided", "Cargo anulado", "checkbox"],
      ],
      payments: [
        project,
        [
          "invoice_id",
          "Cargo al que se aplica",
          "select",
          [
            ["", "Seleccionar cargo"],
            ...s.invoices
              .filter(
                (i) =>
                  !i.voided &&
                  (!values.project_id || i.project_id === values.project_id),
              )
              .map((i) => [
                i.id,
                i.description +
                  " · " +
                  money(balance(i, s.payments), i.currency) +
                  " pendiente",
              ]),
          ],
        ],
        ["amount_cents", "Importe del pago", "money", true],
        [
          "currency",
          "Moneda",
          "select",
          ["ARS", "USD", "EUR"].map((c) => [c, c]),
        ],
        ["date", "Fecha del pago", "date", true],
        ["method", "Medio de pago"],
        ["reference", "Referencia o comprobante"],
        ["voided", "Pago anulado", "checkbox"],
      ],
      advances: [
        project,
        ["months", "Cantidad de meses", "number", true],
        [
          "start_date",
          "Fecha de inicio confirmada (vacío si no se conoce)",
          "date",
        ],
        [
          "amount_cents",
          "Importe total (vacío si no se conoce)",
          "nullablemoney",
        ],
        [
          "currency",
          "Moneda",
          "select",
          ["ARS", "USD", "EUR"].map((c) => [c, c]),
        ],
        ["paid", "El cliente ya pagó este adelanto", "checkbox"],
        ["notes", "Detalle del acuerdo", "textarea"],
        ["voided", "Adelanto anulado", "checkbox"],
      ],
      tasks: [
        project,
        ["title", "Título", "text", true],
        ["description", "Descripción", "textarea"],
        ["status", "Etapa", "select", Object.entries(tasksNames)],
        [
          "priority",
          "Prioridad",
          "select",
          [
            ["low", "Baja"],
            ["normal", "Normal"],
            ["high", "Alta"],
          ],
        ],
        ["due_date", "Fecha objetivo", "date"],
      ],
      notes: [
        project,
        ["title", "Título", "text", true],
        ["body", "Contenido", "textarea"],
      ],
      events: [
        project,
        ["title", "Título", "text", true],
        ["date", "Fecha", "date", true],
        ["start_time", "Hora de inicio", "time", true],
        ["end_time", "Hora de fin", "time", true],
        ["description", "Descripción", "textarea"],
      ],
      messages: [
        project,
        ["subject", "Asunto", "text", true],
        [
          "channel",
          "Canal",
          "select",
          [
            ["email", "Email"],
            ["whatsapp", "WhatsApp"],
            ["note", "Registro interno"],
          ],
        ],
        ["recipient", "Destinatario (email o teléfono internacional)"],
        ["body", "Mensaje", "textarea", true],
      ],
    };
    return base[kind] || [];
  }, [kind, s, values.project_id]);
  function value(key, type, extra) {
    if (values[key] !== undefined && values[key] !== null)
      return ["money", "nullablemoney"].includes(type)
        ? values[key] / 100
        : values[key];
    if (type === "checkbox") return false;
    if (["number", "money"].includes(type))
      return key === "grace_days" || key === "warning_days"
        ? 7
        : key === "months"
          ? 1
          : 0;
    if (type === "select") return extra?.[0]?.[0] || "";
    return "";
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (modal.special === "generate") {
        const result = await api("/billing/generate", "POST", {
          month: values.month || s.today.slice(0, 7),
          ...(modal.project_id ? { project_id: modal.project_id } : {}),
        });
        alert(
          `${result.created.length} cargo(s) creado(s).\n${result.skipped.map((x) => x.project + ": " + x.reason).join("\n")}`,
        );
        saved();
        return;
      }
      const payload = { ...values };
      for (const [key, label, type = "text", extra] of fields)
        if (
          payload[key] === undefined ||
          (payload[key] === null && type !== "nullablemoney")
        ) {
          const v = value(key, type, extra);
          payload[key] = type === "money" ? Math.round(Number(v) * 100) : v;
        }
      if (kind === "messages") {
        payload.status = "draft";
      }
      if (item.id) payload.revision = item.revision;
      await api(
        "/records/" + kind + (item.id ? "/" + item.id : ""),
        item.id ? "PUT" : "POST",
        payload,
      );
      saved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    clients: "cliente",
    projects: "proyecto",
    invoices: "cargo",
    payments: "pago",
    advances: "adelanto",
    tasks: "tarea",
    notes: "nota",
    events: "evento",
    messages: "mensaje",
  };
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <form className="modal" onSubmit={submit}>
        <div className="section-head">
          <div>
            <small className="eyebrow">TU ESPACIO DE TRABAJO</small>
            <h2>
              {modal.special === "generate"
                ? "Generar cargos de un mes"
                : `${item.id ? "Editar" : "Nuevo"} ${titles[kind]}`}
            </h2>
          </div>
          <button type="button" aria-label="Cerrar" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {modal.special === "generate" ? (
          <>
            <p>
              Se usa la fecha de inicio como día del ciclo. Se omiten
              duplicados, proyectos inactivos y períodos totalmente cubiertos
              por un adelanto confirmado. Revisá el mes antes de continuar.
            </p>
            <label>
              Mes del período
              <input
                type="month"
                required
                value={values.month || s.today.slice(0, 7)}
                onChange={(e) =>
                  setValues({ ...values, month: e.target.value })
                }
              />
            </label>
          </>
        ) : (
          fields.map(([key, label, type = "text", extra]) => (
            <label
              key={key}
              className={type === "checkbox" ? "checkbox-label" : ""}
            >
              {type === "checkbox" ? (
                <>
                  <input
                    aria-label={label}
                    type="checkbox"
                    checked={!!value(key, type, extra)}
                    onChange={(e) =>
                      setValues({ ...values, [key]: e.target.checked })
                    }
                  />
                  <span>{label}</span>
                </>
              ) : (
                <>
                  {label}
                  {type === "textarea" ? (
                    <textarea
                      aria-label={label}
                      rows={key === "body" ? 7 : 3}
                      value={value(key, type, extra)}
                      onChange={(e) =>
                        setValues({ ...values, [key]: e.target.value })
                      }
                      required={extra === true}
                    />
                  ) : type === "select" ? (
                    <select
                      aria-label={label}
                      value={value(key, type, extra)}
                      onChange={(e) => {
                        const changes = { [key]: e.target.value };
                        if (kind === "payments" && key === "invoice_id") {
                          const i = s.invoices.find(
                            (i) => i.id === e.target.value,
                          );
                          if (i)
                            Object.assign(changes, {
                              project_id: i.project_id,
                              currency: i.currency,
                              amount_cents: balance(i, s.payments),
                            });
                        }
                        if (kind === "payments" && key === "project_id")
                          changes.invoice_id = "";
                        setValues({ ...values, ...changes });
                      }}
                    >
                      {extra.map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      aria-label={label}
                      type={
                        ["money", "nullablemoney", "number"].includes(type)
                          ? "number"
                          : type
                      }
                      step={
                        ["money", "nullablemoney"].includes(type)
                          ? "0.01"
                          : type === "number"
                            ? "1"
                            : undefined
                      }
                      min={
                        ["money", "nullablemoney", "number"].includes(type)
                          ? 0
                          : undefined
                      }
                      required={extra === true}
                      value={value(key, type, extra)}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [key]: ["money", "nullablemoney"].includes(type)
                            ? e.target.value === ""
                              ? type === "nullablemoney"
                                ? null
                                : 0
                              : Math.round(Number(e.target.value) * 100)
                            : type === "number"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                    />
                  )}
                </>
              )}
            </label>
          ))
        )}
        {["projects", "payments", "invoices", "advances"].includes(kind) && (
          <div className="hint">
            No ingreses contraseñas en observaciones. Verificá fechas y monedas.
            Guardar una suspensión afecta solo a los paneles que tengan el
            conector instalado.
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <div className="modal-footer">
          {item.id && ["events", "tasks", "notes"].includes(kind) && (
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  !confirm(
                    "¿Eliminar este registro? Esta acción no se puede deshacer.",
                  )
                )
                  return;
                setBusy(true);
                try {
                  await api(`/records/${kind}/${item.id}`, "DELETE", {
                    revision: item.revision,
                  });
                  saved();
                } catch (e) {
                  setError(e.message);
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={14} /> Eliminar
            </button>
          )}
          <button type="button" onClick={close} disabled={busy}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            {busy
              ? "Guardando…"
              : modal.special === "generate"
                ? "Generar cargos"
                : "Guardar cambios"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
function SettingsPage({ s, notify, load, onLogout }) {
  const [v, setV] = useState(s.settings),
    [busy, setBusy] = useState(false),
    [audit, setAudit] = useState(null),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState("");
  return (
    <div className="settings-grid">
      <section className="panel">
        <h2>Identidad y contacto</h2>
        <p className="muted">
          Estos datos se usan en el panel y en los avisos de pago.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/settings", "PUT", v);
              load();
              notify("Configuración guardada.");
            } catch (e) {
              notify(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {[
            ["brand", "Nombre del panel"],
            ["owner", "Nombre de tu estudio"],
            ["timezone", "Zona horaria IANA"],
            ["contact_email", "Email de contacto para clientes"],
            ["contact_phone", "Teléfono de contacto"],
          ].map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </label>
          ))}
          <button className="primary" disabled={busy}>
            Guardar configuración
          </button>
        </form>
      </section>
      <div>
        <section className="panel">
          <h2>Datos y copias de seguridad</h2>
          <p>
            La exportación JSON contiene tus registros, no las credenciales ni
            una copia completa de la base.
          </p>
          <a className="button" href="/api/export" download>
            <Download size={16} /> Exportar registros JSON
          </a>
          <div className="hint">
            Para una copia completa ejecutá <code>npm run backup</code> en el
            servidor. Guardá la copia fuera de él. Instrucciones y restauración
            en docs/INSTALACION.md.
          </div>
        </section>
        <section className="panel spaced">
          <h2>Seguridad de tu cuenta</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("/auth/password", "POST", { current, password });
                notify("Contraseña cambiada. Iniciá sesión nuevamente.");
                onLogout();
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            <label>
              Contraseña actual
              <input
                type="password"
                required
                value={current}
                autoComplete="current-password"
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              Nueva contraseña (mínimo 12 caracteres)
              <input
                type="password"
                minLength={12}
                maxLength={200}
                required
                value={password}
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button>Cambiar contraseña y cerrar sesiones</button>
          </form>
        </section>
        <section className="panel spaced">
          <h2>Registro de actividad</h2>
          <p>Últimas 300 operaciones, sin guardar claves ni contraseñas.</p>
          <button
            onClick={async () => {
              try {
                setAudit(await api("/audit"));
              } catch (e) {
                notify(e.message);
              }
            }}
          >
            <Activity size={16} /> Consultar actividad
          </button>
          {audit && (
            <div className="audit-list">
              {audit.map((a) => (
                <p key={a.id}>
                  <strong>
                    {a.action} · {a.entity}
                  </strong>
                  <small>{new Date(a.at).toLocaleString("es-AR")}</small>
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
