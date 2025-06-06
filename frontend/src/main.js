// --- Configuration ---
const VITE_BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL;
const VITE_CLIENT_ID = import.meta.env.VITE_CLIENT_ID;
const VITE_CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET;
const VITE_APP_NAME = import.meta.env.VITE_APP_NAME;

// --- In-memory token store ---
let clientJwt = null;
let userSession = null; // Will hold the full Supabase session object

/**
 * A helper function for making API calls.
 * @param {string} endpoint - The API endpoint to call.
 * @param {string} method - The HTTP method (e.g., 'POST', 'GET').
 * @param {object} body - The request body.
 * @param {string} [token=null] - The JWT to include for authorization.
 * @returns {Promise<object>} The JSON response from the API.
 */
async function apiCall(endpoint, method, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${VITE_BACKEND_API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await response.json();
  if (!response.ok) {
    // Throw an error with the message from the API to be caught by the caller
    throw new Error(data.error || `HTTP error! status: ${response.status}`);
  }
  return data;
}

/**
 * Step 1: Authenticate the client application itself to get a client JWT.
 */
async function initializeApp() {
  try {
    console.log("Initializing app and getting client token...");
    const data = await apiCall('/auth/client-token', 'POST', {
      clientId: VITE_CLIENT_ID,
      clientSecret: VITE_CLIENT_SECRET,
    });
    clientJwt = data.client_jwt;
    console.log("Client token acquired successfully.");
    document.getElementById('output').textContent = 'Client initialized. Ready for user authentication.';
  } catch (error) {
    console.error('Failed to initialize client:', error.message);
    document.getElementById('output').textContent = `Error: ${error.message}`;
  }
}

// --- User Authentication Functions ---

window.register = async () => {
  if (!clientJwt) {
    document.getElementById('output').textContent = 'Client not initialized.';
    return;
  }
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const data = await apiCall('/auth/register', 'POST', {
      email,
      password,
      AppToRegisterWith: VITE_APP_NAME,
    }, clientJwt);
    document.getElementById('output').textContent = 'Registration successful. Please check your email to confirm.';
    document.getElementById('appInfo').textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    document.getElementById('output').textContent = `Error: ${error.message}`;
  }
};

window.login = async () => {
  if (!clientJwt) {
    document.getElementById('output').textContent = 'Client not initialized.';
    return;
  }
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  try {
    const data = await apiCall('/auth/login', 'POST', {
      email,
      password,
      AppToRegisterWith: VITE_APP_NAME,
    }, clientJwt);
    userSession = data; // Store the full session object
    document.getElementById('output').textContent = 'Login successful!';
    document.getElementById('appInfo').textContent = JSON.stringify(userSession, null, 2);
  } catch (error) {
    document.getElementById('output').textContent = `Error: ${error.message}`;
  }
};

window.sendMagic = async () => {
  if (!clientJwt) {
    document.getElementById('output').textContent = 'Client not initialized.';
    return;
  }
  const email = document.getElementById('email').value;
  try {
    const data = await apiCall('/auth/magic', 'POST', {
      email,
      AppToRegisterWith: VITE_APP_NAME,
    }, clientJwt);
    document.getElementById('output').textContent = data.message;
  } catch (error) {
    document.getElementById('output').textContent = `Error: ${error.message}`;
  }
};

// --- Authenticated User Functions ---

window.getProfile = async () => {
    if (!userSession || !userSession.access_token) {
        document.getElementById('output').textContent = 'You must be logged in to get a profile.';
        return;
    }
    try {
        // Note: The endpoint requires the AppToRegisterWith as a query parameter for GET requests
        const endpoint = `/profile?AppToRegisterWith=${VITE_APP_NAME}`;
        const data = await apiCall(endpoint, 'GET', null, userSession.access_token);
        document.getElementById('output').textContent = 'Profile data fetched successfully.';
        document.getElementById('appInfo').textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        document.getElementById('output').textContent = `Error: ${error.message}`;
    }
};


// --- Initial Load ---
initializeApp();