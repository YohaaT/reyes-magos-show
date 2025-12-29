const express = require('express');
const cors = require('cors');
const config = require('./config');
const routes = require('./routes');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const os = require('os');

// Serve static files for audio from system temp dir (where Polly/Uploads go)
// Add CORS headers specifically for audio files to render in Vercel frontend
app.use('/audio', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
}, express.static(os.tmpdir()));

app.use('/api', routes);

// Placeholder for client serving (production)
// app.use(express.static(path.join(__dirname, '../client/dist')));

// Export for Vercel (Serverless)
module.exports = app;

// Start server only if run directly (Local Dev)
if (require.main === module) {
    app.listen(config.PORT, () => {
        console.log(`Server running on port ${config.PORT}`);
    });
}
