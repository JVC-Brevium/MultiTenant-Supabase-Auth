require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// --- Primary Supabase Client (for connecting to the main directory) ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- Private Helper Functions ---

/**
 * Validates and retrieves the server's email confirmation policy from environment variables.
 * @returns {boolean} The value of the email_confirm setting.
 * @throws {Error} If the environment variable is misconfigured.
 */
function getConfirmationSetting() {
  const setting = process.env.REGISTER_NO_CONFIRMATION_EMAIL;
  if (setting === 'true') {
    return true;
  }
  if (setting === 'false') {
    return false;
  }
  throw new Error('Server configuration error: REGISTER_NO_CONFIRMATION_EMAIL is misconfigured.');
}

/**
 * Retrieves the full configuration for a specific tenant application from the main database.
 * @param {string} appName - The name of the application to look up.
 * @returns {Promise<object>} The application's configuration object.
 * @throws {Error} If the application is not found.
 */
async function getTenantConfig(appName) {
  const { data, error } = await supabase
    .from('applications')
    .select('supabase_url, supabase_role_key, supabase_anonymous_key, supabase_jwt_secret, supabase_db_transaction_url')
    .eq('application_name', appName)
    .single();

  if (error) {
    console.error('Error fetching tenant config:', error.message);
    throw new Error(`Application not found: ${appName}`);
  }
  if (!data) {
    throw new Error(`Application not found: ${appName}`);
  }
  return data;
}

/**
 * Creates a new Supabase client instance for a specific tenant.
 * @param {object} config - The tenant's configuration object from getTenantConfig.
 * @returns {object} A new Supabase client instance.
 */
function createTenantClient(config) {
  return createClient(config.supabase_url, config.supabase_role_key);
}


// --- API Endpoints ---

app.post('/auth/register', async (req, res) => {
  const { email, password, AppToRegisterWith } = req.body;

  if (!email || !password || !AppToRegisterWith) {
    return res.status(400).json({ error: 'Email, password, and AppToRegisterWith are required.' });
  }

  try {
    const shouldConfirmEmail = getConfirmationSetting();
    const tenantConfig = await getTenantConfig(AppToRegisterWith);
    const tenantSupabase = createTenantClient(tenantConfig);

    const { data, error } = await tenantSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: shouldConfirmEmail,
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    if (err.message.startsWith('Application not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.startsWith('Server configuration error')) {
        return res.status(500).json({ error: err.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password, AppToRegisterWith } = req.body;

  if (!email || !password || !AppToRegisterWith) {
    return res.status(400).json({ error: 'Email, password, and AppToRegisterWith are required.' });
  }

  try {
    const tenantConfig = await getTenantConfig(AppToRegisterWith);
    const tenantSupabase = createTenantClient(tenantConfig);

    const { data, error } = await tenantSupabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.json(data);
  } catch (err) {
    if (err.message.startsWith('Application not found')) {
        return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

app.post('/auth/magic', async (req, res) => {
    const { email, AppToRegisterWith } = req.body;

    if (!email || !AppToRegisterWith) {
        return res.status(400).json({ error: 'Email and AppToRegisterWith are required.' });
    }

    try {
        const tenantConfig = await getTenantConfig(AppToRegisterWith);
        const tenantSupabase = createTenantClient(tenantConfig);

        const { error } = await tenantSupabase.auth.signInWithOtp({ email });
        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Magic link sent if email is valid.' });
    } catch (err) {
        if (err.message.startsWith('Application not found')) {
            return res.status(404).json({ error: err.message });
        }
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});

app.get('/ping', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const appName = req.query.AppToRegisterWith;

  if (!token) return res.status(401).json({ error: 'No token provided' });
  if (!appName) return res.status(400).json({ error: 'AppToRegisterWith query parameter is required.' });

  try {
    const tenantConfig = await getTenantConfig(appName);
    const payload = jwt.verify(token, tenantConfig.supabase_jwt_secret);
    const data = `{response: ${JSON.stringify(payload)} pong }`;
    res.json(data);
  } catch (err) {
    if (err.message.startsWith('Application not found')) {
        return res.status(404).json({ error: err.message });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Note: The /profile endpoint is more complex in a multi-tenant system.
// It would need its own logic to determine which tenant's profile table to query.
// This is left as-is for now as it was not part of the primary request.
app.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    // WARNING: This uses the primary project's JWT secret and profiles table.
    // A full multi-tenant implementation would require a lookup similar to /ping.
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', payload.sub).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));