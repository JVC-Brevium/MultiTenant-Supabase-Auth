require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());

// --- Primary Supabase Client (for connecting to the main directory) ---
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- Private Helper Functions ---

function getConfirmationSetting() {
  const setting = process.env.REGISTER_NO_CONFIRMATION_EMAIL;
  if (setting === 'true') return true;
  if (setting === 'false') return false;
  throw new Error('Server configuration error: REGISTER_NO_CONFIRMATION_EMAIL is misconfigured.');
}

async function getTenantConfig(appName) {
  // Assumes your applications table has: client_id, client_secret_hash, supabase_url, etc.
  const { data, error } = await supabase
    .from('applications')
    .select('client_id, client_secret_hash, supabase_url, supabase_role_key, supabase_anonymous_key, supabase_jwt_secret')
    .eq('application_name', appName)
    .single();

  if (error || !data) {
    throw new Error(`Application not found: ${appName}`);
  }
  return data;
}

function createTenantClient(config) {
  return createClient(config.supabase_url, config.supabase_role_key);
}

// --- Middleware ---

/**
 * Middleware to validate a Client JWT. Protects user-auth endpoints.
 */
function validateClientToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No client token provided' });
    }
    try {
        const payload = jwt.verify(token, process.env.MAIN_APP_JWT_SECRET);
        if (payload.grant_type !== 'client_credentials') {
            throw new Error('Invalid token type');
        }
        req.clientApp = payload; // Attach client app info to request
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired client token' });
    }
}

/**
 * Middleware to validate a User JWT (Supabase access token). Protects user-specific endpoints.
 */
async function authenticateUserToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    const appName = req.query.AppToRegisterWith || req.body.AppToRegisterWith;

    if (!token) {
        return res.status(401).json({ error: 'No user token provided' });
    }
    if (!appName) {
        return res.status(400).json({ error: 'Application identifier is required.' });
    }

    try {
        const tenantConfig = await getTenantConfig(appName);
        const payload = jwt.verify(token, tenantConfig.supabase_jwt_secret);
        req.user = payload; // Attach user payload to request
        req.tenantConfig = tenantConfig; // Attach tenant config for use in the handler
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired user token' });
    }
}


// --- API Endpoints ---

// Tier 1: Client Authentication
app.post('/auth/client-token', async (req, res) => {
    const { clientId, clientSecret } = req.body;
    if (!clientId || !clientSecret) {
        return res.status(400).json({ error: 'clientId and clientSecret are required.' });
    }

    try {
        const { data: appData, error } = await supabase
            .from('applications')
            .select('client_secret_hash, application_name')
            .eq('client_id', clientId)
            .single();

        if (error || !appData) {
            return res.status(401).json({ error: 'Invalid client credentials' });
        }

        const isValid = await bcrypt.compare(clientSecret, appData.client_secret_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid client credentials' });
        }

        const clientJwt = jwt.sign(
            { grant_type: 'client_credentials', appName: appData.application_name },
            process.env.MAIN_APP_JWT_SECRET,
            { expiresIn: '1h' } // Client token is short-lived
        );

        res.json({ client_jwt: clientJwt });

    } catch (err) {
        console.error('Client token error:', err);
        res.status(500).json({ error: 'An unexpected error occurred.' });
    }
});


// Tier 2: User Authentication (Protected by Client JWT)
app.post('/auth/register', validateClientToken, async (req, res) => {
  const { email, password, AppToRegisterWith } = req.body;
  // ... (rest of the logic is now safe, as it's protected)
  try {
    const shouldConfirmEmail = getConfirmationSetting();
    const tenantConfig = await getTenantConfig(AppToRegisterWith);
    const tenantSupabase = createTenantClient(tenantConfig);
    const { data, error } = await tenantSupabase.auth.admin.createUser({
      email, password, email_confirm: shouldConfirmEmail,
    });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    // ... error handling
  }
});

app.post('/auth/login', validateClientToken, async (req, res) => {
  const { email, password, AppToRegisterWith } = req.body;
  // ...
  try {
    const tenantConfig = await getTenantConfig(AppToRegisterWith);
    const tenantSupabase = createTenantClient(tenantConfig);
    const { data, error } = await tenantSupabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.json(data);
  } catch (err) {
    // ... error handling
  }
});

app.post('/auth/magic', validateClientToken, async (req, res) => {
    const { email, AppToRegisterWith } = req.body;
    // ...
    try {
        const tenantConfig = await getTenantConfig(AppToRegisterWith);
        const tenantSupabase = createTenantClient(tenantConfig);
        const { error } = await tenantSupabase.auth.signInWithOtp({ email });
        if (error) return res.status(400).json({ error: error.message });
        res.json({ message: 'Magic link sent if email is valid.' });
    } catch (err) {
        // ... error handling
    }
});

// Tier 3: User Data (Protected by User JWT)
app.get('/profile', authenticateUserToken, async (req, res) => {
    // The middleware has already validated the token and attached user and tenantConfig
    const userId = req.user.sub;
    const tenantSupabase = createTenantClient(req.tenantConfig);
    const { data, error } = await tenantSupabase.from('profiles').select('*').eq('id', userId).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
});

// --- Utility Endpoints ---
app.get('/ping', authenticateUserToken, async (req, res) => {
  // Middleware handles all validation. If we get here, the token is valid.
  res.json({ response: req.user, message: 'pong' });
});

app.get('/health', async (req, res) => {
  try {
    const { count: userCount, error: userError } = await supabase.rpc('count_users');
    if (userError) throw new Error(`User count check failed: ${userError.message}`);

    const { count: appCount, error: appError } = await supabase
      .from('applications')
      .select('*', { count: 'exact', head: true });
    if (appError) throw new Error(`Application count check failed: ${appError.message}`);

    if (userCount > 0 && appCount > 0) {
      res.status(200).json({ status: 'ok', checks: { users: userCount, applications: appCount } });
    } else {
      throw new Error(`Health check failed: users=${userCount}, applications=${appCount}`);
    }
  } catch (err) {
    console.error('Health check endpoint error:', err.message);
    res.status(503).json({ status: 'error', message: err.message });
  }
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));