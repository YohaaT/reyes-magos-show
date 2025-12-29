require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  // BASE_URL for API calls (backend)
  BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
  // FRONTEND_URL for user links (client)
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION || 'eu-west-1',
  POLLY_VOICE_ID: process.env.POLLY_VOICE_ID || 'Lupe',
  SESSION_TTL: 30 * 60 * 1000,
};
