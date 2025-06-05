import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const applicationName = import.meta.env.VITE_SUPABASE_APP;
let targetAppSupaURL = '';
let targetAppSupaKey = '';


async function getAppConnectInfo(applicationName) {
  const { data, error } = await supabase
    .from('applications')              // your public schema table
    .select('*')                // select fields
    .eq('application_name', applicationName)        // condition
    .single();                  // expect exactly one row
  targetAppSupaURL = data.supabase_url;
  targetAppSupaKey = data.supabase_anonymous_key;
  document.getElementById('appInfo').textContent = error ? error.message : JSON.stringify(data.session, null, 2);
  if (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }
  return data;
}

async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')              // your public schema table
    .select('*')                // select fields
    .eq('id', userid)        // condition
    .single();                  // expect exactly one row
  if (error) {
    console.error('Error fetching user:', error.message);
    return null;
  }
  return data;
}

async function initializeApp() {
  const appData = await getAppConnectInfo(applicationName);

  if (!appData) {
    console.error("Initialization failed: Could not get app connection info.");
    document.getElementById('output').textContent = "Initialization failed: Could not get app connection info.";
    return;
  }

  const targetAppSupabase = createClient(targetAppSupaURL, targetAppSupaKey);

  async function insertUser() {
    const { data: { user }, error: userError } = await targetAppSupabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Must be logged in to insert user data');
      return;
    }

    const { data: usersData, error: usersError } = await targetAppSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (usersError && usersError.code !== 'PGRST116') {
        console.error('Error checking for user:', usersError.message);
        return;
    }
    
    if (!usersData) {
      const { data, error } = await targetAppSupabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
            full_name: 'Jane Doe',
            is_admin: false,
            created_at: new Date()
          }
        ])
        .select();

      if (error) {
        console.error('Insert error:', error.message);
      } else {
        console.log('User inserted:', data);
      }
    }
  };

  window.register = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { data, error } = await targetAppSupabase.auth.signUp({ email, password });
    document.getElementById('output').textContent = error ? error.message : 'Registration completed successfully';
    document.getElementById('appInfo').textContent = data ? JSON.stringify(data) : 'No data returned';
  };

  window.login = async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { data, error } = await targetAppSupabase.auth.signInWithPassword({ email, password });
    
    if (!error && data.user) {
      await insertUser();
    }
    document.getElementById('output').textContent = error ? error.message : 'Sign in complete.';
    document.getElementById('appInfo').textContent = data ? JSON.stringify(data) : 'no data returned';
  };

  window.sendMagic = async () => {
    const email = document.getElementById('email').value;
    const { error } = await targetAppSupabase.auth.signInWithOtp({ email });
    document.getElementById('output').textContent = error ? error.message : "Magic link sent.";
  };
}

initializeApp();