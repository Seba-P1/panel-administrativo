export function today(timezone = "America/Argentina/Buenos_Aires") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function daysBetween(a, b) {
  return Math.round(
    (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
  );
}
export function addMonths(date, months) {
  const [y, m, d] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last), 12))
    .toISOString()
    .slice(0, 10);
}
export function invoiceBalance(invoice, payments) {
  if (invoice.voided) return 0;
  return Math.max(
    0,
    invoice.amount_cents -
      payments
        .filter((p) => !p.voided && p.invoice_id === invoice.id)
        .reduce((s, p) => s + p.amount_cents, 0),
  );
}
export function billingStatus(
  project,
  invoices,
  payments,
  advances,
  date = today(),
) {
  const bills = invoices.filter(
    (i) => i.project_id === project.id && !i.voided,
  );
  const due = bills
    .map((i) => ({
      ...i,
      balance_cents: invoiceBalance(i, payments),
      days: daysBetween(date, i.due_date),
    }))
    .filter((i) => i.balance_cents > 0);
  const debt_by_currency = {};
  for (const i of due)
    debt_by_currency[i.currency] =
      (debt_by_currency[i.currency] || 0) + i.balance_cents;
  const overdue = due.filter((i) => i.days < 0);
  const next = [...due].sort((a, b) => a.due_date.localeCompare(b.due_date))[0];
  const coverage = advances
    .filter(
      (a) =>
        a.project_id === project.id &&
        !a.voided &&
        a.paid &&
        a.start_date &&
        a.start_date <= date &&
        date < addMonths(a.start_date, a.months),
    )
    .sort((a, b) =>
      addMonths(b.start_date, b.months).localeCompare(
        addMonths(a.start_date, a.months),
      ),
    )[0];
  const pending_advance = advances.some(
    (a) => a.project_id === project.id && !a.voided && a.paid && !a.start_date,
  );
  const automatic =
    project.billing_enabled &&
    project.auto_suspend &&
    project.policy_accepted &&
    overdue.some((i) => -i.days > project.grace_days);
  const suspended = project.manual_suspended || automatic;
  let state = "unconfigured",
    message = "Falta confirmar el período de alquiler y sus comprobantes.";
  if (project.phase !== "active") {
    state = "inactive";
    message = "Proyecto en preparación; cobro no iniciado.";
  } else if (overdue.length) {
    state = "overdue";
    message = `Tenés ${overdue.length} cargo(s) vencido(s). Contactá al administrador para regularizar el pago.`;
  } else if (next) {
    state = "due";
    message =
      next.days === 0
        ? "Tu alquiler vence hoy."
        : `Faltan ${next.days} días para el vencimiento de tu alquiler.`;
  } else if (coverage) {
    state = "paid";
    message = `Alquiler cubierto hasta el ${addMonths(coverage.start_date, coverage.months)} (fecha de renovación).`;
  } else if (pending_advance) {
    state = "review";
    message =
      "Pago adelantado registrado; falta confirmar desde qué fecha se aplica.";
  } else if (
    bills.length &&
    bills.every((i) => invoiceBalance(i, payments) === 0)
  ) {
    state = "paid";
    message =
      "Los cargos registrados están al día; verificá el siguiente período de alquiler.";
  }
  if (suspended) {
    state = "suspended";
    message =
      "El acceso administrativo está suspendido. Contactá al administrador.";
  }
  return {
    state,
    message,
    suspended,
    reason: suspended
      ? project.manual_suspended
        ? "manual"
        : "overdue"
      : null,
    scope: "admin_only",
    debt_by_currency,
    next_due: next?.due_date || null,
    days_to_due: next?.days ?? null,
    coverage_end: coverage
      ? addMonths(coverage.start_date, coverage.months)
      : null,
    pending_advance,
    as_of: date,
    warning_days: project.warning_days,
  };
}
