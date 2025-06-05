require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json(data);
});

app.post('/auth/magic', async (req, res) => {
  const { email } = req.body;
  const { data, error } = await supabase.auth.signInWithOtp({ email });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Magic link sent if email is valid.' });
});

app.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const { data, error } = await supabase.from('profiles').select('*').eq('id', payload.sub).single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});


app.get('/ping', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const data = `{response: ${JSON.stringify(payload)} pong }`;
    res.json(data);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.listen(3000, () => console.log('API running on http://localhost:3000'));