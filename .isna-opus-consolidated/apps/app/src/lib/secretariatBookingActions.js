/**
 * Actions secrétariat sur les demandes de rendez-vous (Smart Booking).
 * Utilisé par useSecretariatAppointments et Messagerie unifiée.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object|null|undefined} requestRow - ligne appointment_requests (avec student_id)
 * @param {{ scheduled_at?: string|null, assigned_teacher_id?: string|null, video_meeting_url?: string|null }} options
 */
export async function confirmSecretariatAppointmentRequest(supabase, requestRow, options) {
  const id = requestRow?.id;
  if (!id) return { error: new Error('Demande introuvable') };
  const bookingChannel = String(requestRow?.booking_channel || 'prorascience').toLowerCase() === 'ngowazulu'
    ? 'ngowazulu'
    : 'prorascience';

  const scheduled_at = options?.scheduled_at ?? null;
  const assigned_teacher_id = options?.assigned_teacher_id ?? null;
  const video_meeting_url = options?.video_meeting_url ?? null;

  /** Garde-fou : ne pas confirmer deux fois la même demande si un RDV agenda existe déjà. */
  if (scheduled_at) {
    const { data: existingForRequest } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('appointment_request_id', id)
      .not('status', 'eq', 'cancelled')
      .maybeSingle();
    if (existingForRequest?.id) {
      return {
        error: new Error(
          "Ce rendez-vous est déjà enregistré dans l'agenda. Actualisez la page pour voir l'état actuel."
        ),
      };
    }
  }

  if (scheduled_at && assigned_teacher_id) {
    const slotIso = new Date(scheduled_at).toISOString();
    const [{ data: sameReq }, { data: sameAppt }] = await Promise.all([
      supabase
        .from('appointment_requests')
        .select('id')
        .eq('booking_channel', bookingChannel)
        .eq('assigned_teacher_id', assigned_teacher_id)
        .in('status', ['pending', 'confirmed'])
        .eq('scheduled_at', slotIso)
        .neq('id', id)
        .limit(1),
      supabase
        .from('appointments')
        .select('id')
        .eq('booking_channel', bookingChannel)
        .eq('teacher_id', assigned_teacher_id)
        .in('status', ['scheduled', 'in_progress', 'rescheduled', 'live_now'])
        .eq('scheduled_at', slotIso)
        .limit(1),
    ]);
    if ((sameReq || []).length > 0 || (sameAppt || []).length > 0) {
      return { error: new Error('Ce créneau est déjà réservé pour ce secrétariat.') };
    }
  }

  const { error: err } = await supabase
    .from('appointment_requests')
    .update({
      status: 'confirmed',
      scheduled_at: scheduled_at || null,
      assigned_teacher_id: assigned_teacher_id || null,
      video_meeting_url: video_meeting_url || null,
    })
    .eq('id', id);
  if (err) return { error: err };

  if (requestRow && scheduled_at) {
    const { error: apptErr } = await supabase.from('appointments').insert({
      appointment_request_id: id,
      student_id: requestRow.student_id,
      teacher_id: assigned_teacher_id || null,
      type: 'entretien',
      booking_channel: bookingChannel,
      scheduled_at: new Date(scheduled_at).toISOString(),
      duration_minutes: 30,
      status: 'scheduled',
      video_meeting_url: video_meeting_url || null,
    });
    if (apptErr) {
      const msg = String(apptErr.message || '').toLowerCase();
      if (msg.includes('duplicate') || msg.includes('unique')) {
        return {
          error: new Error(
            "Un rendez-vous lié à cette demande existe déjà. Actualisez la page avant de réessayer."
          ),
        };
      }
      return { error: apptErr };
    }
  }

  if (requestRow?.student_id) {
    const notif = {
      user_id: requestRow.student_id,
      type: 'appointment',
      title: 'Entretien validé',
      message: scheduled_at
        ? `Votre entretien est programmé pour ${new Date(scheduled_at).toLocaleString('fr-FR')}.`
        : "Votre demande d'entretien est validée.",
      is_read: false,
      action_url:
        bookingChannel === 'ngowazulu'
          ? '/appointment/request?flow=ngowazulu-consultation'
          : '/appointment/request',
    };
    const { error: nErr } = await supabase.from('notifications').insert(notif);
    if (nErr) console.warn('[secretariatBookingActions] notification insert failed', nErr);
  }

  return { error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id - appointment_requests.id
 */
export async function cancelSecretariatAppointmentRequest(supabase, id) {
  const { data: row, error: fetchErr } = await supabase
    .from('appointment_requests')
    .select('id, student_id, booking_reference, booking_channel')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr };
  if (!row) return { error: new Error('Demande introuvable') };

  const { error: err } = await supabase.from('appointment_requests').update({ status: 'cancelled' }).eq('id', id);
  if (err) return { error: err };

  if (row.student_id) {
    const ref = row.booking_reference ? String(row.booking_reference).trim().slice(0, 14) : '';
    const channel = String(row.booking_channel || 'prorascience').toLowerCase() === 'ngowazulu' ? 'ngowazulu' : 'prorascience';
    const payload = {
      user_id: row.student_id,
      type: 'appointment',
      title: 'Demande de rendez-vous refusée',
      message: ref
        ? `Votre demande de rendez-vous (réf. ${ref}) n'a pas été retenue. Vous pouvez proposer une nouvelle date ou contacter le secrétariat.`
        : `Votre demande de rendez-vous n'a pas été retenue. Vous pouvez proposer une nouvelle date ou contacter le secrétariat.`,
      is_read: false,
      action_url:
        channel === 'ngowazulu'
          ? '/appointment/request?flow=ngowazulu-consultation'
          : '/appointment/request',
    };
    const { error: nErr } = await supabase.from('notifications').insert(payload);
    if (nErr) console.warn('[secretariatBookingActions] cancel notification insert failed', nErr);
  }

  return { error: null };
}

/**
 * Marque une demande comme à reprogrammer (file reprogrammation / calendrier).
 */
export async function markAppointmentRequestReschedule(supabase, id) {
  const { error: err } = await supabase.from('appointment_requests').update({ status: 'rescheduled' }).eq('id', id);
  if (err) return { error: err };
  return { error: null };
}
