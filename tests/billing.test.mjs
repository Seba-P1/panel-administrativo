import test from "node:test";
import assert from "node:assert/strict";
import {
  billingStatus,
  invoiceBalance,
  addMonths,
  daysBetween,
  today,
} from "../server/billing.mjs";
const p = {
  id: "p",
  phase: "active",
  billing_enabled: true,
  auto_suspend: false,
  policy_accepted: false,
  grace_days: 7,
  warning_days: 7,
  manual_suspended: false,
};
const invoice = {
  id: "i",
  project_id: "p",
  amount_cents: 10000,
  currency: "ARS",
  due_date: "2026-07-10",
  voided: false,
};
const status = (
  patch = {},
  invoices = [],
  payments = [],
  advances = [],
  date = "2026-07-12",
) => billingStatus({ ...p, ...patch }, invoices, payments, advances, date);
test("No inventa deuda ni estado al día cuando faltan comprobantes", () => {
  const s = status();
  assert.equal(s.state, "unconfigured");
  assert.deepEqual(s.debt_by_currency, {});
});
test("Adelanto sin fecha permanece para revisión", () => {
  assert.equal(
    status(
      {},
      [],
      [],
      [{ project_id: "p", months: 6, paid: true, start_date: "" }],
    ).state,
    "review",
  );
});
test("Seis meses confirmados cubren hasta la renovación exclusiva", () => {
  const a = [
    { project_id: "p", months: 6, paid: true, start_date: "2026-07-01" },
  ];
  assert.equal(status({}, [], [], a).state, "paid");
  assert.equal(status({}, [], [], a).coverage_end, "2027-01-01");
  assert.equal(status({}, [], [], a, "2027-01-01").state, "unconfigured");
});
test("Pago parcial conserva saldo exacto en centavos", () => {
  assert.equal(
    invoiceBalance(invoice, [{ invoice_id: "i", amount_cents: 3000 }]),
    7000,
  );
});
test("Pagos anulados no cancelan deuda", () => {
  assert.equal(
    invoiceBalance(invoice, [
      { invoice_id: "i", amount_cents: 10000, voided: true },
    ]),
    10000,
  );
});
test("Monedas no se suman entre sí", () => {
  assert.deepEqual(
    status({}, [
      invoice,
      { ...invoice, id: "u", currency: "USD", amount_cents: 500 },
    ]).debt_by_currency,
    { ARS: 10000, USD: 500 },
  );
});
test("Mora sin permiso no suspende", () => {
  assert.equal(status({}, [invoice]).suspended, false);
});
test("Suspensión automática exige acuerdo y gestión habilitada", () => {
  assert.equal(
    status(
      { auto_suspend: true, policy_accepted: false },
      [invoice],
      [],
      [],
      "2026-07-30",
    ).suspended,
    false,
  );
  assert.equal(
    status(
      { auto_suspend: true, policy_accepted: true, billing_enabled: false },
      [invoice],
      [],
      [],
      "2026-07-30",
    ).suspended,
    false,
  );
});
test("Respeta exactamente los días de gracia", () => {
  assert.equal(
    status(
      { auto_suspend: true, policy_accepted: true },
      [invoice],
      [],
      [],
      "2026-07-17",
    ).suspended,
    false,
  );
  assert.equal(
    status(
      { auto_suspend: true, policy_accepted: true },
      [invoice],
      [],
      [],
      "2026-07-18",
    ).suspended,
    true,
  );
});
test("Un pago completo regulariza la suspensión automática", () => {
  const s = status(
    { auto_suspend: true, policy_accepted: true },
    [invoice],
    [{ invoice_id: "i", amount_cents: 10000 }],
    [],
    "2026-07-30",
  );
  assert.equal(s.suspended, false);
  assert.equal(s.state, "paid");
});
test("Suspensión manual permanece hasta quitarla manualmente", () => {
  assert.equal(
    status(
      { manual_suspended: true },
      [invoice],
      [{ invoice_id: "i", amount_cents: 10000 }],
    ).suspended,
    true,
  );
});
test("Los cargos anulados no generan deuda", () => {
  assert.deepEqual(
    status({}, [{ ...invoice, voided: true }]).debt_by_currency,
    {},
  );
});
test("El vencimiento de hoy no se considera atrasado", () => {
  assert.equal(status({}, [invoice], [], [], "2026-07-10").state, "due");
  assert.equal(status({}, [invoice], [], [], "2026-07-10").days_to_due, 0);
});
test("Un adelanto no borra deudas anteriores", () => {
  assert.equal(
    status(
      {},
      [invoice],
      [],
      [{ project_id: "p", months: 6, paid: true, start_date: "2026-07-01" }],
    ).state,
    "overdue",
  );
});
test("Los meses respetan fin de mes y años bisiestos", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-07-01", 6), "2027-01-01");
});
test("Calendario por días sin errores de horario de verano", () => {
  assert.equal(daysBetween("2026-03-07", "2026-03-09"), 2);
  assert.match(today("America/Argentina/Buenos_Aires"), /^\d{4}-\d{2}-\d{2}$/);
});
