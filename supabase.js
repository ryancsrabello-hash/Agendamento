import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://woeekpaqnbwtdvvqheit.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rCse-76DLO4a6Ye51JAPvg_BAQWh4bO';
const STATE_ROW_ID = 'main';

const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

async function loadStore() {
  const { data, error } = await client
    .from('app_state')
    .select('data')
    .eq('id', STATE_ROW_ID)
    .maybeSingle();

  if (error) throw error;
  return data ? data.data : null;
}

async function saveStore(store) {
  const { error } = await client
    .from('app_state')
    .upsert({
      id: STATE_ROW_ID,
      data: store,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });

  if (error) throw error;
}

function subscribeStore(onChange) {
  return client
    .channel('instituto-lins-rabello-store')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_state', filter: `id=eq.${STATE_ROW_ID}` },
      (payload) => {
        if (payload.new && payload.new.data) onChange(payload.new.data);
      }
    )
    .subscribe();
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
  return client.auth.onAuthStateChange((_event, session) => {
    callback(session ? session.user : null);
  });
}

window.ILRSupabase = {
  client,
  loadStore,
  saveStore,
  subscribeStore,
  signIn,
  signOut,
  getCurrentUser,
  isAuthorizedTeamMember,
  onAuthChange
};
window.dispatchEvent(new Event('ilr-supabase-ready'));

export { client, loadStore, saveStore, subscribeStore, signIn, signOut, getCurrentUser, isAuthorizedTeamMember, onAuthChange };
