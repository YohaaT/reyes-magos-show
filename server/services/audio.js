const sessionService = require('./session');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

// Initialize Clients
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
const pollyClient = new PollyClient({ region: config.AWS_REGION });

// MOCK CONSTANTS
const MOCK_TRANSCRIPTION = "¿Cuántos camellos tenéis?";
const MOCK_AUDIO_URL = "https://actions.google.com/sounds/v1/speech/greeting_en.ogg";

async function transcribe(sessionId, audioId) {
    console.log(`\n[🔍 TEST STEP 1: STT] Recibido Audio ID: ${audioId}`);
    return MOCK_TRANSCRIPTION;
}

async function generateReply(data) {
    try {
        const { session_id, user_input, king = 'GASPAR' } = data;
        console.log(`\n[LLM] Generating reply for session ${session_id} | Input: "${user_input.text}"`);

        const session = sessionService.sessions.get(session_id);
        if (session) {
            session.questions_used_for_person += 1;
        }

        const childName = session?.participants[session?.current_participant_index]?.name || 'el niño';
        const gift = session?.participants[session?.current_participant_index]?.gift || 'un regalo sorpresa';

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
                model: "gpt-3.5-turbo",
                max_tokens: 100,
            });
            responseText = completion.choices[0].message.content;
        } catch (error) {
            console.error("OpenAI Error:", error);
            responseText = "Jo, jo, jo. La magia a veces tiene interferencias, pero te escuchamos con el corazón.";
        }

        console.log(`[LLM] Response: "${responseText}"`);

        let ttsResult = await generateTTS(session_id, 'gaspar_neural', responseText);

        if (!ttsResult || !ttsResult.tts_audio_url) {
            console.error("CRITICAL: TTS returned null URL");
            ttsResult = {
                tts_audio_url: MOCK_AUDIO_URL,
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

        if (session) {
            session.next_action_queue.push({
                phase: 'ANSWER',
                king: king,
                ...result
            });
            session.current_phase = 'ANSWER';
        }

        return result;
    } catch (globalError) {
        console.error("CRITICAL ERROR IN generateReply:", globalError);
        return {
            spoken_text: "Hubo un error mágico.",
            subtitle_text: "Hubo un error mágico.",
            animation_cue: 'idle',
            tts_audio_url: MOCK_AUDIO_URL,
            duration_ms: 2000
        };
    }
}

async function generateTTS(sessionId, voiceId, text) {
    console.log(`[TTS] Generating audio for: "${text}" with voice ${voiceId || config.POLLY_VOICE_ID}`);

    if (!text) return { tts_audio_url: MOCK_AUDIO_URL, duration_ms: 0 };

    let pollyVoice = 'Sergio';
    if (voiceId && ['Sergio', 'Miguel', 'Enrique', 'Lucia', 'Lupe', 'Mia'].includes(voiceId)) {
        pollyVoice = voiceId;
    }

    const params = {
        Text: text,
        OutputFormat: 'mp3',
        VoiceId: pollyVoice,
        Engine: 'neural',
        LanguageCode: 'es-ES'
    };

    try {
        const command = new SynthesizeSpeechCommand(params);
        const response = await pollyClient.send(command);

        if (response.AudioStream) {
            const filename = `tts_${sessionId}_${uuidv4()}.mp3`;
            const filePath = path.join(os.tmpdir(), filename);
            const audioBuffer = await response.AudioStream.transformToByteArray();
            fs.writeFileSync(filePath, Buffer.from(audioBuffer));

            const words = text.split(' ').length;
            const durationMs = Math.max(2000, (words / 2.5) * 1000);
            const audioUrl = `${config.BASE_URL}/audio/${filename}`;

            console.log(`[TTS] Generated: ${audioUrl}`);
            return {
                tts_audio_url: audioUrl,
                duration_ms: durationMs
            };
        }
    } catch (error) {
        console.error('[TTS Error FULL]', error);
        return {
            tts_audio_url: MOCK_AUDIO_URL,
            duration_ms: 3000,
            error: error.message
        };
    }

    return {
        tts_audio_url: MOCK_AUDIO_URL,
        duration_ms: 2000,
        error: "No stream returned"
    };
}

module.exports = {
    transcribe,
    generateReply,
    generateTTS
};
