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

async function generateTTS(sessionId, voiceId, text) {
    // Call AWS Polly
    console.log(`[TTS] Generating audio for: "${text}"`);

    // Mock result
    return {
        tts_audio_url: MOCK_AUDIO_URL,
        duration_ms: 5000 // Mock duration
    };
}

module.exports = {
    transcribe,
    generateReply,
    generateTTS
};
