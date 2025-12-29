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

        // In a real scenario we might upload to S3 here.
        // For now we just return the local ID/path references.
        const audioId = file.filename;

        // Trigger async processing or just return ID for client to trigger STT
        res.json({ audio_id: audioId });
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

module.exports = router;
