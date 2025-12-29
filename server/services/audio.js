const sessionService = require('./session');
const config = require('../config');
// import fs, axios etc for real implementation

// MOCK CONSTANTS
const MOCK_TRANSCRIPTION = "¿Cuántos camellos tenéis?";
const MOCK_REPLY_TEXT = "Tenemos muchísimos camellos, tantos como estrellas hay en el cielo. Son nuestros fieles compañeros de viaje.";
const MOCK_AUDIO_URL = "https://actions.google.com/sounds/v1/speech/greeting_en.ogg"; // Fallback URL

async function transcribe(sessionId, audioId) {
    console.log(`\n[🔍 TEST STEP 1: STT] Recibido Audio ID: ${audioId}`);
    console.log(`[ℹ️] Simulando transcripción (aún no conectamos Google STT)...`);

    // 1. Locate audio file from audioId
    // 2. Call Google STT
    // 3. Return text
    console.log(`[STT] Transcribing audio ${audioId} for session ${sessionId}`);

    // Real implementation stub:
    /*
    const client = new speech.SpeechClient();
    const audioBytes = fs.readFileSync(filepath).toString('base64');
    const request = {
      audio: { content: audioBytes },
      config: { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: 'es-ES' }
    };
    const [response] = await client.recognize(request);
    return response.results.map(r => r.alternatives[0].transcript).join('\n');
    */

    return MOCK_TRANSCRIPTION;
}

async function generateReply(data) {
    console.log(`\n[🔍 TEST STEP 2: LLM] Generando respuesta para: "${data.user_input.text}"`);
    console.log(`[ℹ️] Usando respuesta MOCK (aún no conectamos OpenAI)...`);

    // data contains: session_id, user_input, etc.
    console.log(`[LLM] Generating reply for session ${data.session_id}`);

    const { session_id, user_input } = data;

    // 1. Validate whitelist with LLM or regex
    // 2. Generate response using Master Prompt
    // 3. Update session stats (questions used)

    const session = sessionService.sessions.get(session_id);
    if (session) {
        session.questions_used_for_person += 1;
        // Logic to enforce limits would go here
    }

    // Mock LLM Response
    const responseText = MOCK_REPLY_TEXT;

    // 4. Generate TTS for the response immediately (for latency optimization)
    const ttsResult = await generateTTS(session_id, 'gaspar_neural', responseText);

    const result = {
        spoken_text: responseText,
        subtitle_text: responseText,
        animation_cue: 'talk_happy',
        next_phase_suggestion: 'GIFT_REVEAL', // Or QUESTION_WINDOW if mult-turn allowed
        should_open_question_window: false,
        question_window_seconds: 0,
        classified_intent: 'camels_count',
        safety_redirect_used: false,
        tts_audio_url: ttsResult.tts_audio_url,
        duration_ms: ttsResult.duration_ms
    };

    // Queue this into the session so /session/next can pick it up if the TV is polling
    // OR the TV uses the response from /reply if the architecture was different.
    // Based on the spec:
    // "TV recibe evento y reproduce." -> Implicitly via polling /session/next or socket.
    // BUT /reply output is JSON, which allows the System to know what to play.
    // If the TV is "dumb" and just polls, we must push this to the queue.
    if (session) {
        session.next_action_queue.push({
            phase: 'ANSWER',
            king: 'GASPAR', // Should match
            ...result
        });
        // Update phase
        session.current_phase = 'ANSWER';
    }

    return result;
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { v4: uuidv4 } = require('uuid');

// Initialize Polly Client
// Region and credentials will be automatically picked up from process.env if set correctly
// Env vars needed: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
const pollyClient = new PollyClient({ region: config.AWS_REGION });

async function generateTTS(sessionId, voiceId, text) {
    console.log(`[TTS] Generating audio for: "${text}" with voice ${voiceId || config.POLLY_VOICE_ID}`);

    if (!text) return { tts_audio_url: null, duration_ms: 0 };

    // Mapping custom voice IDs to Polly Voices if needed
    // 'gaspar_neural' -> 'Sergio' (Spanish male) or 'Lupe' (Spanish female)
    // Reyes Magos Map:
    // Melchor: 'Miguel' (Standard) or 'Sergio' (Neural)
    // Gaspar: 'Enrique' (Standard)
    // Baltasar: 'Sergio' (Neural)
    // For MVP we just use a default or what is passed if valid.

    // Fallback voice
    let pollyVoice = 'Sergio';
    if (voiceId && ['Sergio', 'Miguel', 'Enrique', 'Lucia', 'Lupe', 'Mia'].includes(voiceId)) {
        pollyVoice = voiceId;
    }

    const params = {
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: pollyVoice,
        Engine: 'neural', // Prefer neural for quality
        LanguageCode: 'es-ES'
    };

    try {
        const command = new SynthesizeSpeechCommand(params);
        const response = await pollyClient.send(command);

        if (response.AudioStream) {
            const filename = `tts_${sessionId}_${uuidv4()}.mp3`;
            const filePath = path.join(os.tmpdir(), filename);

            // Write stream to file
            const audioBuffer = await response.AudioStream.transformToByteArray();
            fs.writeFileSync(filePath, Buffer.from(audioBuffer));

            // Calculate duration roughly (or assume standard speech rate)
            // Helper: approx 150 words per minute -> 2.5 words per second
            const words = text.split(' ').length;
            const durationMs = Math.max(2000, (words / 2.5) * 1000);

            // Construct URL assuming /audio is mapped to os.tmpdir()
            // In Render, config.BASE_URL is the domain.
            const audioUrl = `${config.BASE_URL}/audio/${filename}`;

            console.log(`[TTS] Generated: ${audioUrl}`);
            return {
                tts_audio_url: audioUrl,
                duration_ms: durationMs
            };
        }
    } catch (error) {
        console.error('[TTS Error]', error);
        // Fallback to mock if AWS fails
        return {
            tts_audio_url: MOCK_AUDIO_URL,
            duration_ms: 3000
        };
    }

    return { tts_audio_url: null, duration_ms: 0 };
}

module.exports = {
    transcribe,
    generateReply,
    generateTTS
};
