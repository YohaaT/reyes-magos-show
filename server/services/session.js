const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// In-memory session store
const sessions = new Map();

// Phases
const PHASES = {
    INTRO: 'INTRO',
    RULES: 'RULES',
    TURN_START: 'TURN_START',
    BUILDUP: 'BUILDUP',
    CHALLENGE_OR_HINT: 'CHALLENGE_OR_HINT',
    QUESTION_WINDOW: 'QUESTION_WINDOW',
    ANSWER: 'ANSWER',
    GIFT_REVEAL: 'GIFT_REVEAL',
    TURN_END: 'TURN_END',
    CLOSING: 'CLOSING'
};

const KINGS = ['MELCHOR', 'GASPAR', 'BALTASAR'];

const SCRIPTS = {
    INTRO: "¡Hola! Somos los Reyes Magos. Hemos viajado desde muy lejos siguiendo la estrella.",
    RULES: "Antes de entregar los regalos, queremos hablar un poco con vosotros. ¿Estáis listos?",
    CLOSING: "Ha sido maravilloso visitaros. ¡Sed muy buenos! ¡Hasta el año que viene!"
};

async function createSession(data) {
    const sessionId = uuidv4();
    // Lazy load to avoid circular dependency
    const audioService = require('./audio');

    // 1. Prepare Session Data Structure
    const newSession = {
        id: sessionId,
        created_at: Date.now(),
        pack: data.pack || 'basic',
        participants: data.participants || [],
        gifts: data.gifts || [],
        settings: data.settings || {},

        // State
        current_phase: PHASES.INTRO,
        current_king_index: 0,
        current_participant_index: 0,
        questions_used_for_person: 0,
        next_action_queue: [],

        // Cache for pre-generated audios (Optimize TV Latency)
        assets: {
            intro: null,
            closing: null,
            turns: [] // Array matching participants index
        }
    };

    // 2. Pre-generate Audios (Parallel execution for speed)
    console.log(`[Session ${sessionId}] Pre-generating assets...`);

    // A. Intro
    const pIntro = audioService.generateTTS(sessionId, 'Enrique', SCRIPTS.INTRO);

    // B. Closing
    const pClosing = audioService.generateTTS(sessionId, 'Miguel', SCRIPTS.CLOSING);

    // C. Turn Starts (Welcome for each child)
    const pTurns = newSession.participants.map((p, index) => {
        const king = KINGS[index % 3]; // Round robin assignment
        const voiceId = king === 'GASPAR' ? 'Enrique' : (king === 'MELCHOR' ? 'Miguel' : 'Sergio');
        const text = `¡${p.name}! La estrella nos habló de ti...`;
        return audioService.generateTTS(sessionId, voiceId, text);
    });

    try {
        // Wait for all generations to complete
        const [introRes, closingRes, ...turnsRes] = await Promise.all([pIntro, pClosing, ...pTurns]);

        newSession.assets.intro = introRes;
        newSession.assets.closing = closingRes;
        newSession.assets.turns = turnsRes;

        console.log(`[Session ${sessionId}] Assets ready.`);
    } catch (e) {
        console.error(`[Session ${sessionId}] Asset generation warning:`, e);
        // If pre-gen fails, session continues but might lack some audio, or retry logic could be added
    }

    sessions.set(sessionId, newSession);

    const frontendUrl = data.frontend_url || config.FRONTEND_URL;

    return {
        session_id: sessionId,
        tv_url: `${frontendUrl}/s/${sessionId}?mode=tv`,
        mobile_url: `${frontendUrl}/s/${sessionId}?mode=mic`
    };
}

async function getNextState(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    let event = {};

    // Check Queue (Dynamic Responses)
    if (session.next_action_queue.length > 0) {
        event = session.next_action_queue.shift();
        return event;
    }

    // Standard Flow (Using Pre-generated Assets)
    switch (session.current_phase) {
        case PHASES.INTRO:
            const intro = session.assets.intro || { tts_audio_url: null, duration_ms: 3000 };
            event = {
                phase: PHASES.INTRO,
                king: KINGS[0],
                subtitle_text: SCRIPTS.INTRO,
                tts_audio_url: intro.tts_audio_url,
                duration_ms: intro.duration_ms,
                animation_cue: 'talk_happy',
                should_open_question_window: false
            };
            session.current_phase = PHASES.TURN_START;
            break;

        case PHASES.TURN_START:
            const pIndex = session.current_participant_index;
            const p = session.participants[pIndex];
            const king = KINGS[session.current_king_index % 3];

            // Retrieve pre-generated audio safely
            const turnAudio = (session.assets.turns && session.assets.turns[pIndex])
                ? session.assets.turns[pIndex]
                : { tts_audio_url: null, duration_ms: 3000 };

            const welcomeText = `¡${p.name}! La estrella nos habló de ti...`;

            event = {
                phase: PHASES.TURN_START,
                king: king,
                subtitle_text: welcomeText,
                tts_audio_url: turnAudio.tts_audio_url,
                duration_ms: turnAudio.duration_ms,
                animation_cue: 'talk_happy',
                should_open_question_window: true,
                question_window_seconds: session.pack === 'basic' ? 12 : 15
            };
            session.current_phase = PHASES.QUESTION_WINDOW;
            break;

        case PHASES.QUESTION_WINDOW:
            event = {
                phase: PHASES.QUESTION_WINDOW,
                king: KINGS[session.current_king_index % 3],
                subtitle_text: "Te escuchamos...",
                animation_cue: "idle",
                should_open_question_window: true
            };
            break;

        case PHASES.ANSWER:
            session.current_phase = PHASES.GIFT_REVEAL;
            return getNextState(sessionId);

        case PHASES.GIFT_REVEAL:
            // Fast transition for MVP
            session.current_participant_index++;
            if (session.current_participant_index >= session.participants.length) {
                session.current_phase = PHASES.CLOSING;
            } else {
                session.current_phase = PHASES.TURN_START;
                session.current_king_index++;
            }
            return getNextState(sessionId);

        case PHASES.CLOSING:
            const closing = session.assets.closing || { tts_audio_url: null, duration_ms: 5000 };
            event = {
                phase: PHASES.CLOSING,
                king: KINGS[1],
                subtitle_text: SCRIPTS.CLOSING,
                tts_audio_url: closing.tts_audio_url,
                duration_ms: closing.duration_ms,
                animation_cue: 'wave',
                should_open_question_window: false
            };
            break;

        default:
            event = {
                phase: session.current_phase,
                king: KINGS[0],
                subtitle_text: "...",
                animation_cue: 'idle'
            };
            break;
    }

    return event;
}

module.exports = {
    createSession,
    getNextState,
    sessions
};
