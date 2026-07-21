const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildKmUpdateReminder,
  normalizeReminder,
} = require("../reminders");
const { buildReminderCandidates } = require("../pushReminders");
const { didMileageChange } = require("../vehicleMileage");

function buildVehicle(overrides = {}) {
  return {
    id: 10,
    nombre: "Vehiculo",
    modelo: "Modelo",
    patente: "AAA111",
    km_actual: 13,
    km_updated_at: "2026-07-20T10:00:00.000Z",
    ultimo_service_km: 10000,
    intervalo_km: 5000,
    fecha_ultimo_service: "2026-01-01",
    intervalo_tiempo: 6,
    vehicle_reminders_enabled: true,
    notify_days_before: 30,
    notify_km_before: 1000,
    km_update_reminder_days: 1,
    latest_fecha: null,
    latest_km: null,
    ...overrides,
  };
}

test("km update reminder requires update when current km is null", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: null,
    kmUpdatedAt: null,
    kmUpdateReminderDays: 1,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, true);
  assert.equal(reminder.reason, "missing_current_km");
});

test("km update reminder requires update when km_updated_at is null", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: 13,
    kmUpdatedAt: null,
    kmUpdateReminderDays: 1,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, true);
  assert.equal(reminder.reason, "missing_km_updated_at");
});

test("km update reminder does not trigger before 24 hours", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: 13,
    kmUpdatedAt: "2026-07-20T12:30:00.000Z",
    kmUpdateReminderDays: 1,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, false);
});

test("km update reminder triggers at exactly 24 hours", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: 13,
    kmUpdatedAt: "2026-07-20T12:00:00.000Z",
    kmUpdateReminderDays: 1,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, true);
  assert.equal(reminder.dueSnapshot, "2026-07-21T12:00:00.000Z");
});

test("km update reminder triggers after more than 24 hours", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: 13,
    kmUpdatedAt: "2026-07-20T10:00:00.000Z",
    kmUpdateReminderDays: 1,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, true);
  assert.equal(reminder.dueSnapshot, "2026-07-21T10:00:00.000Z");
});

test("km update reminder supports intervals greater than one day", () => {
  const reminder = buildKmUpdateReminder({
    currentKm: 13,
    kmUpdatedAt: "2026-07-18T12:00:00.000Z",
    kmUpdateReminderDays: 3,
    now: new Date("2026-07-21T12:00:00.000Z"),
  });

  assert.equal(reminder.needsUpdate, true);
  assert.equal(reminder.dueSnapshot, "2026-07-21T12:00:00.000Z");
});

test("km update reminder stays disabled for invalid intervals", () => {
  [null, 0, -1].forEach((value) => {
    const normalized = normalizeReminder(
      buildVehicle({ km_update_reminder_days: value }),
      { now: new Date("2026-07-21T12:00:00.000Z") }
    );

    assert.equal(normalized.kmUpdateReminder.enabled, false);
    assert.equal(normalized.kmUpdateReminder.needsUpdate, false);
  });
});

test("equivalent number and string km values do not count as changes", () => {
  assert.equal(didMileageChange(13, "13"), false);
  assert.equal(didMileageChange("13", 13), false);
});

test("editing another field without changing km does not count as mileage change", () => {
  assert.equal(didMileageChange(13, 13), false);
});

test("changing km value counts as mileage change", () => {
  assert.equal(didMileageChange(13, 14), true);
  assert.equal(didMileageChange(13, null), true);
});

test("cooldown dedupe stays stable within the same overdue period", () => {
  const baseVehicle = buildVehicle({
    km_updated_at: "2026-07-20T10:00:00.000Z",
  });

  const firstReminder = normalizeReminder(baseVehicle, {
    now: new Date("2026-07-21T12:00:00.000Z"),
  });
  const secondReminder = normalizeReminder(baseVehicle, {
    now: new Date("2026-07-21T12:30:00.000Z"),
  });

  const firstCandidate = buildReminderCandidates(firstReminder).find((item) => item.type === "km_update_needed");
  const secondCandidate = buildReminderCandidates(secondReminder).find((item) => item.type === "km_update_needed");

  assert.equal(firstCandidate.dedupeKey, secondCandidate.dedupeKey);
});

test("km update reminder opens a new dedupe period after the next interval elapses", () => {
  const baseVehicle = buildVehicle({
    km_updated_at: "2026-07-20T10:00:00.000Z",
  });

  const firstReminder = normalizeReminder(baseVehicle, {
    now: new Date("2026-07-21T12:00:00.000Z"),
  });
  const secondReminder = normalizeReminder(baseVehicle, {
    now: new Date("2026-07-22T12:00:00.000Z"),
  });

  const firstCandidate = buildReminderCandidates(firstReminder).find((item) => item.type === "km_update_needed");
  const secondCandidate = buildReminderCandidates(secondReminder).find((item) => item.type === "km_update_needed");

  assert.notEqual(firstCandidate.dedupeKey, secondCandidate.dedupeKey);
});
