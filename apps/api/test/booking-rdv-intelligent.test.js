'use strict';
/**
 * Tests — le système de RDV n'est plus aveugle (P0 PLAN_RDV_INTELLIGENT).
 *  · respondInvitation referme la boucle : RDV mis à jour + événement + cloche staff + e-mail accueil
 *  · refus d'invitation → statut reschedule_declined + mêmes signaux
 *  · demande entrante (avec créneau) → le staff est notifié
 *  · annulation par le demandeur → événement + cloche staff
 *
 *   npm run build && node --test test/booking-rdv-intelligent.test.js   (depuis apps/api)
 */
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert');
const { BookingService } = require('../dist/booking/booking.service.js');
const { BookingAdvancedService } = require('../dist/booking/booking-advanced.service.js');

// ─── Supabase simulé : chaîne universelle + journal des écritures ────────────
// `results[table]` = valeur ou fn(état) → data. Les écritures (insert/update)
// sont journalisées dans `ops` pour les assertions.
function makeDb(results = {}) {
  const ops = [];
  function chain(table) {
    const state = { table, op: null, payload: null };
    const c = {};
    ['select', 'eq', 'neq', 'in', 'gte', 'lte', 'order', 'limit', 'or'].forEach((m) => {
      c[m] = () => c;
    });
    c.insert = (payload) => { state.op = 'insert'; state.payload = payload; ops.push(state); return c; };
    c.update = (payload) => { state.op = 'update'; state.payload = payload; ops.push(state); return c; };
    c.delete = () => { state.op = 'delete'; ops.push(state); return c; };
    const resolve = () => {
      const h = results[table];
      const data = typeof h === 'function' ? h(state) : (h !== undefined ? h : null);
      return { data, error: null };
    };
    c.single = async () => resolve();
    c.maybeSingle = async () => resolve();
    // `await query` sans .single() (listes) : la chaîne est "thenable".
    c.then = (cb) => Promise.resolve(resolve()).then(cb);
    return c;
  }
  return { supabase: { client: { from: (t) => chain(t) } }, ops };
}

function makeNotifications() {
  const sent = [];
  return { sent, svc: { send: async (tenantId, userId, payload) => { sent.push({ tenantId, userId, payload }); return {}; } } };
}

const CONFIG = { get: () => undefined };
const TENANT_ID = 'tenant-1';
const STAFF = [{ user_id: 'staff-1', role: 'owner' }];

// Les signaux post-réponse sont partiellement fire-and-forget (`void ...`) :
// on laisse la micro-file se vider avant d'asserter.
const settle = () => new Promise((r) => setTimeout(r, 20));

function futureInvitation(extra = {}) {
  return {
    id: 'inv-1',
    tenant_id: TENANT_ID,
    appointment_id: 'appt-1',
    slot_id: 'slot-9',
    status: 'sent',
    accepted_at: null,
    declined_at: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    ...extra,
  };
}

test('respondInvitation accept → RDV confirmé à la date du créneau + événement + cloche + e-mail accueil', async () => {
  const inv = futureInvitation();
  const { supabase, ops } = makeDb({
    booking_invitations: (s) => (s.op === 'update' ? { ...inv, status: 'accepted' } : inv),
    booking_slots: { id: 'slot-9', start_at: '2026-08-10T09:00:00.000Z' },
    tenant_memberships: STAFF,
    tenant_notification_settings: { notify_email: 'accueil@prorascience.org', email_from: null, email_from_name: null },
  });
  const { sent, svc: notifications } = makeNotifications();
  const booking = new BookingService(supabase, {}, notifications);
  const svc = new BookingAdvancedService(supabase, CONFIG, booking);

  const r = await svc.respondInvitation({ token: 'tok-1', decision: 'accept' });
  await settle();

  assert.strictEqual(r.status, 'recorded');
  // Le RDV lui-même est réécrit (plus de mémoire morte dans booking_invitations).
  const apptUpdate = ops.find((o) => o.table === 'appointments' && o.op === 'update');
  assert.ok(apptUpdate, 'appointments doit être mis à jour');
  assert.strictEqual(apptUpdate.payload.status, 'confirmed');
  assert.strictEqual(apptUpdate.payload.slot_id, 'slot-9');
  // Événement d'historique.
  const ev = ops.find((o) => o.table === 'appointment_events' && o.op === 'insert');
  assert.ok(ev, 'un événement doit être journalisé');
  assert.strictEqual(ev.payload.kind, 'client_responded');
  assert.strictEqual(ev.payload.appointment_id, 'appt-1');
  // Cloche staff.
  assert.ok(sent.some((n) => n.userId === 'staff-1'), 'le staff doit être notifié');
  // E-mail à l'accueil (notify_email) via email_queue.
  const mail = ops.find((o) => o.table === 'email_queue' && o.op === 'insert');
  assert.ok(mail, 'un e-mail accueil doit être mis en file');
  assert.strictEqual(mail.payload.to, 'accueil@prorascience.org');
});

test('respondInvitation decline → statut reschedule_declined + événement + cloche', async () => {
  const inv = futureInvitation({ slot_id: null });
  const { supabase, ops } = makeDb({
    booking_invitations: (s) => (s.op === 'update' ? { ...inv, status: 'declined' } : inv),
    tenant_memberships: STAFF,
    tenant_notification_settings: { notify_email: '', email_from: null, email_from_name: null },
  });
  const { sent, svc: notifications } = makeNotifications();
  const booking = new BookingService(supabase, {}, notifications);
  const svc = new BookingAdvancedService(supabase, CONFIG, booking);

  const r = await svc.respondInvitation({ token: 'tok-1', decision: 'decline' });
  await settle();

  assert.strictEqual(r.status, 'recorded');
  const apptUpdate = ops.find((o) => o.table === 'appointments' && o.op === 'update');
  assert.ok(apptUpdate, 'appointments doit être mis à jour');
  assert.strictEqual(apptUpdate.payload.status, 'reschedule_declined');
  const ev = ops.find((o) => o.table === 'appointment_events' && o.op === 'insert');
  assert.ok(ev, 'un événement doit être journalisé');
  assert.strictEqual(ev.payload.kind, 'reschedule_declined');
  assert.ok(sent.some((n) => n.userId === 'staff-1'), 'le staff doit être notifié');
  // Pas de notify_email configuré → aucun e-mail accueil (et surtout pas de crash).
  assert.ok(!ops.some((o) => o.table === 'email_queue'), 'pas d’e-mail sans notify_email');
});

test('respondInvitation sans appointment_id → réponse enregistrée, aucun signal RDV (pas de crash)', async () => {
  const inv = futureInvitation({ appointment_id: null, slot_id: null });
  const { supabase, ops } = makeDb({
    booking_invitations: (s) => (s.op === 'update' ? { ...inv, status: 'accepted' } : inv),
  });
  const { svc: notifications } = makeNotifications();
  const booking = new BookingService(supabase, {}, notifications);
  const svc = new BookingAdvancedService(supabase, CONFIG, booking);

  const r = await svc.respondInvitation({ token: 'tok-1', decision: 'accept' });
  await settle();
  assert.strictEqual(r.status, 'recorded');
  assert.ok(!ops.some((o) => o.table === 'appointments'), 'aucune écriture appointments');
});

test('requestAppointment (demande entrante avec créneau) → événement + cloche staff', async () => {
  const { supabase, ops } = makeDb({
    booking_slots: { id: 'slot-1', status: 'available', start_at: '2026-08-12T10:00:00.000Z', title: 'Consultation' },
    appointments: (s) => (s.op === 'insert' ? { id: 'appt-1' } : null),
    tenant_memberships: STAFF,
  });
  const { sent, svc: notifications } = makeNotifications();
  const booking = new BookingService(supabase, {}, notifications);

  const r = await booking.requestAppointment({ id: TENANT_ID }, 'user-1', { slotId: 'slot-1' });
  await settle();

  assert.strictEqual(r.id, 'appt-1');
  const ev = ops.find((o) => o.table === 'appointment_events' && o.op === 'insert');
  assert.ok(ev, 'la demande doit être journalisée');
  assert.strictEqual(ev.payload.kind, 'requested');
  const staffNotif = sent.find((n) => n.userId === 'staff-1');
  assert.ok(staffNotif, 'le staff doit être notifié de la demande entrante');
  assert.match(staffNotif.payload.title, /Nouvelle demande/i);
});

test('cancelOwnAppointment (annulation par le demandeur) → événement cancelled + cloche staff', async () => {
  const { supabase, ops } = makeDb({
    appointments: (s) => (s.op === 'update'
      ? { id: 'appt-1', status: 'cancelled' }
      : { id: 'appt-1', student_id: 'user-1' }),
    tenant_memberships: STAFF,
  });
  const { sent, svc: notifications } = makeNotifications();
  const booking = new BookingService(supabase, {}, notifications);

  const r = await booking.cancelOwnAppointment('appt-1', TENANT_ID, 'user-1');
  await settle();

  assert.strictEqual(r.status, 'cancelled');
  const ev = ops.find((o) => o.table === 'appointment_events' && o.op === 'insert');
  assert.ok(ev, 'l’annulation doit être journalisée');
  assert.strictEqual(ev.payload.kind, 'cancelled');
  assert.strictEqual(ev.payload.actor_type, 'client');
  assert.ok(sent.some((n) => n.userId === 'staff-1'), 'le staff doit être notifié de l’annulation');
});
