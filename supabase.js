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

window.ILRSupabase = {
  client, loadStore, saveStore, subscribeStore, createPublicBooking, lookupAppointments,
  signIn, signOut, getCurrentUser, isAuthorizedTeamMember, onAuthChange
};
window.dispatchEvent(new Event('ilr-supabase-ready'));
