import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://woeekpaqnbwtdvvqheit.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rCse-76DLO4a6Ye51JAPvg_BAQWh4bO';
const STATE_ROW_ID = 'main';

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

async function currentAuthorizedUser() {
  const { data } = await client.auth.getUser();
  if (!data?.user) return null;
  const { data: allowed, error } = await client.rpc('is_team_member');
  if (error || allowed !== true) return null;
  return data.user;
}

async function loadStore() {
  const user = await currentAuthorizedUser();
  if (user) {
    const { data, error } = await client.from('app_state').select('data').eq('id', STATE_ROW_ID).maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  }

  const { data, error } = await client.rpc('get_public_app_state');
  if (error) throw error;
  return data || null;
}

async function saveStore(store) {
  const user = await currentAuthorizedUser();
  if (!user) throw new Error('Apenas a equipe autenticada pode alterar os dados administrativos.');

  const { error } = await client.from('app_state').upsert({
    id: STATE_ROW_ID,
    data: store,
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' });
  if (error) throw error;
}

async function createPublicBooking(booking) {
  const { data, error } = await client.rpc('create_public_booking', { p_booking: booking });
  if (error) throw error;
  return data;
}

async function lookupAppointments(phone) {
  const { data, error } = await client.rpc('lookup_public_appointments', { p_phone: phone });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function subscribeStore(onChange) {
  let channel = null;
  currentAuthorizedUser().then((user) => {
    if (!user) return;
    channel = client.channel('instituto-lins-rabello-store')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${STATE_ROW_ID}` },
        (payload) => { if (payload.new?.data) onChange(payload.new.data); })
      .subscribe();
  });
  return { unsubscribe: () => channel?.unsubscribe() };
}

async function signIn(email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}
async function signOut() {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}
async function isAuthorizedTeamMember() {
  const { data, error } = await client.rpc('is_team_member');
  if (error) throw error;
  return data === true;
}
async function getCurrentUser() {
  const { data, error } = await client.auth.getUser();
  if (error) return null;
  return data.user || null;
}
function onAuthChange(callback) {
  return client.auth.onAuthStateChange((_event, session) => callback(session ? session.user : null));
}


async function requireTeamUser() {
  const user = await currentAuthorizedUser();
  if (!user) throw new Error('Sessão da equipe não encontrada. Entre novamente.');
  return user;
}

async function loadClinicalRecord(patientId) {
  await requireTeamUser();
  const [recordRes, evolutionRes, toothRes] = await Promise.all([
    client.from('prontuarios').select('*').eq('paciente_id', patientId).order('atualizado_em', { ascending: false }).limit(1).maybeSingle(),
    client.from('evolucoes_clinicas').select('*').eq('paciente_id', patientId).order('data_atendimento', { ascending: false }).order('criado_em', { ascending: false }),
    client.from('odontograma').select('*').eq('paciente_id', patientId).order('dente')
  ]);
  if (recordRes.error) throw recordRes.error;
  if (evolutionRes.error) throw evolutionRes.error;
  if (toothRes.error) throw toothRes.error;
  return { prontuario: recordRes.data || null, evolucoes: evolutionRes.data || [], odontograma: toothRes.data || [] };
}

async function saveAnamnesis(patientId, values) {
  await requireTeamUser();
  const { data: existing, error: readError } = await client.from('prontuarios').select('id').eq('paciente_id', patientId).limit(1).maybeSingle();
  if (readError) throw readError;
  const payload = { ...values, paciente_id: patientId, atualizado_em: new Date().toISOString() };
  const query = existing
    ? client.from('prontuarios').update(payload).eq('id', existing.id).select().single()
    : client.from('prontuarios').insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function saveTooth(patientId, tooth, values) {
  await requireTeamUser();
  const { data, error } = await client.from('odontograma').upsert({
    paciente_id: patientId, dente: String(tooth), condicao: values.condicao,
    observacoes: values.observacoes || '', atualizado_em: new Date().toISOString()
  }, { onConflict: 'paciente_id,dente' }).select().single();
  if (error) throw error;
  return data;
}

async function addEvolution(patientId, values) {
  const user = await requireTeamUser();
  const { data, error } = await client.from('evolucoes_clinicas').insert({
    paciente_id: patientId, profissional_email: user.email || null,
    data_atendimento: values.data_atendimento, procedimento: values.procedimento || null,
    descricao: values.descricao, conduta: values.conduta || null, observacoes: values.observacoes || null
  }).select().single();
  if (error) throw error;
  return data;
}

window.ILRSupabase = {
  client, loadStore, saveStore, subscribeStore, createPublicBooking, lookupAppointments,
  signIn, signOut, getCurrentUser, isAuthorizedTeamMember, onAuthChange,
  loadClinicalRecord, saveAnamnesis, saveTooth, addEvolution
};
window.dispatchEvent(new Event('ilr-supabase-ready'));
