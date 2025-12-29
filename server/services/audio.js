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

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY }); // Will use process.env automatically if config maps it

async function generateReply(data) {
    const { session_id, user_input, king = 'GASPAR' } = data;
    console.log(`\n[LLM] Generating reply for session ${session_id} | Input: "${user_input.text}"`);

    const session = sessionService.sessions.get(session_id);
    if (session) {
        session.questions_used_for_person += 1;
    }

    // 1. Construct Prompt
    // In a full app, we would inject context about the child (name, gift, behavior) here.
    const childName = session?.participants[session?.current_participant_index]?.name || 'el niño';
    const gift = session?.participants[session?.current_participant_index]?.gift || 'un regalo sorpresa';

    // System Prompt defining the Persona
    const systemPrompt = `Eres ${king}, uno de los Reyes Magos. 
    Estás hablando con ${childName}. 
    Tu tono es sabio, mágico, amable y un poco antiguo.
    Responde a su pregunta de forma breve (máximo 2 frases).
    El niño espera el regalo: ${gift}.
    No rompas el personaje. Eres mágico de verdad.`;

    let responseText = "";

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: user_input.text }
            ],
            model: "gpt-3.5-turbo", // Or gpt-4-turbo for better creation
            max_tokens: 100,
        });

        responseText = completion.choices[0].message.content;
    } catch (error) {
        console.error("OpenAI Error:", error);
        responseText = "Jo, jo, jo. La magia a veces tiene interferencias, pero te escuchamos con el corazón.";
    }

    console.log(`[LLM] Response: "${responseText}"`);

    // 2. Generate TTS immediately
    let ttsResult = await generateTTS(session_id, 'gaspar_neural', responseText);

    // Safety check: specific fallback if null
    if (!ttsResult || !ttsResult.tts_audio_url) {
        console.error("CRITICAL: TTS returned null URL");
        ttsResult = {
            tts_audio_url: "https://actions.google.com/sounds/v1/speech/greeting_en.ogg",
            duration_ms: 2000
        };
        responseText += " (Error de Audio)";
    }

    const result = {
        spoken_text: responseText,
        subtitle_text: responseText,
        animation_cue: 'talk_happy',
        next_phase_suggestion: 'GIFT_REVEAL',
        should_open_question_window: false,
        question_window_seconds: 0,
        tts_audio_url: ttsResult.tts_audio_url,
        duration_ms: ttsResult.duration_ms
    };

    // 3. Queue logic for TV
    if (session) {
        session.next_action_queue.push({
            phase: 'ANSWER',
            king: king,
            ...result
        });
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
        console.error('[TTS Error FULL]', error);

        // Return a public fallback URL that definitely works if AWS fails
        // This helps distinguish between "No URL sent" vs "AWS Failed"
        return {
            tts_audio_url: "https://actions.google.com/sounds/v1/speech/greeting_en.ogg",
            duration_ms: 3000,
            error: error.message // Pass error up for debugging
        };
    }

    return {
        tts_audio_url: "https://actions.google.com/sounds/v1/speech/greeting_en.ogg",
        duration_ms: 2000,
        error: "No stream returned"
    };
}

module.exports = {
    transcribe,
    generateReply,
    generateTTS
};
