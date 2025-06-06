const bcrypt = require('bcrypt');

// Get the secret from the command-line arguments
const rawSecret = process.argv[2];

if (!rawSecret) {
  console.error('Usage: node hash-secret.js <secret_to_hash>');
  process.exit(1);
}

const saltRounds = 10;

// Hash the secret and print the result to the console
bcrypt.hash(rawSecret, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing secret:', err);
    process.exit(1);
  }
  console.log(hash);
});