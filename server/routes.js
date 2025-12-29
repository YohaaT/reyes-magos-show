const express = require('express');
const router = express.Router();
const sessionService = require('./services/session');
const audioService = require('./services/audio'); // Orchestrator for STT/TTS/LLM
const os = require('os');
const upload = require('multer')({ dest: os.tmpdir() });

// 1) POST /session/create
router.post('/session/create', async (req, res) => {
    try {
        const result = await sessionService.createSession(req.body);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 2) POST /session/next
router.post('/session/next', async (req, res) => {
    try {
        const result = await sessionService.getNextState(req.body.session_id);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 3) POST /audio/upload
router.post('/audio/upload', upload.single('audio_file'), async (req, res) => {
    try {
        const { session_id, person_id } = req.body;
        const file = req.file;
        if (!file) throw new Error('No file uploaded');

        // Rename file to have an extension (Whisper needs it usually, or helps debugging)
        // We assume webm because the client records in webm/opus usually
        const newFilename = file.filename + '.webm';
        const fs = require('fs');
        const path = require('path');
        const oldPath = file.path;
        const newPath = path.join(file.destination, newFilename);

        fs.renameSync(oldPath, newPath);

        console.log(`[Upload] File saved: ${newPath} (${file.size} bytes)`);

        // Trigger async processing or just return ID for client to trigger STT
        res.json({ audio_id: newFilename });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 4) POST /stt
router.post('/stt', async (req, res) => {
    try {
        const { session_id, audio_id } = req.body;
        const text = await audioService.transcribe(session_id, audio_id);
        res.json({ text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 5) POST /reply
router.post('/reply', async (req, res) => {
    try {
        const result = await audioService.generateReply(req.body);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 6) POST /tts
router.post('/tts', async (req, res) => {
    try {
        const { session_id, voice_id, text } = req.body;
        const result = await audioService.generateTTS(session_id, voice_id, text);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Test route for Polly
router.get('/test-polly', async (req, res) => {
    try {
        console.log("Testing Polly...");
        const result = await audioService.generateTTS('test_' + Date.now(), 'Sergio', 'Hola. Si escuchas esto, la magia funciona perfectamente.');
        res.json({ success: true, url: result.tts_audio_url, detail: result });
    } catch (error) {
        console.error("Polly Test Failed:", error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
});

// Debug route to inspect session
router.get('/debug/session/:sessionId', (req, res) => {
    const session = sessionService.sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
});

module.exports = router;
