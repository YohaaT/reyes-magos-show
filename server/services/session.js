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

// Added scripts for Listening and Gift
const SCRIPTS = {
    INTRO: "¡Hola! Somos los Reyes Magos. Hemos viajado desde muy lejos siguiendo la estrella.",
    LISTENING: "Te escuchamos con atención...",
    GIFT: "¡Mira lo que ha aparecido! Es un regalo mágico.",
    CLOSING: "Ha sido maravilloso visitaros. ¡Sed muy buenos! ¡Hasta el año que viene!"
};

async function createSession(data) {
    const sessionId = uuidv4();
    const audioService = require('./audio'); // Lazy load

    // 1. Prepare Session Data Structure
    const newSession = {
        id: sessionId,
        created_at: Date.now(),
        pack: data.pack || 'basic',
        participants: data.participants || [],
        gifts: data.gifts || [],
        settings: data.settings || {},

        // State Machine Vars
        current_phase: PHASES.INTRO,
        phase_start_time: 0, // 0 means "Not Started Yet" until TV connects
        tv_connected_at: 0,

        current_king_index: 0,
        current_participant_index: 0,
        questions_used_for_person: 0,
        next_action_queue: [],

        // Cache for pre-generated audios
        assets: {
            intro: null,
            listening: null, // NEW
            gift: null,      // NEW
            closing: null,
            turns: []
        }
    };

    // 2. Pre-generate Audios
    console.log(`[Session ${sessionId}] Pre-generating assets...`);

    // Using 'Sergio' as confirmed working voice
    const pIntro = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.INTRO);
    const pListening = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.LISTENING);
    const pGift = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.GIFT);
    const pClosing = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.CLOSING);

    const pTurns = newSession.participants.map((p, index) => {
        const king = KINGS[index % 3];
        const voiceId = 'Sergio';
        const text = `¡${p.name}! La estrella nos habló de ti...`;
        return audioService.generateTTS(sessionId, voiceId, text);
    });

    try {
        const [introRes, listRes, giftRes, closingRes, ...turnsRes] = await Promise.all([pIntro, pListening, pGift, pClosing, ...pTurns]);

        newSession.assets.intro = introRes;
        newSession.assets.listening = listRes;
        newSession.assets.gift = giftRes;
        newSession.assets.closing = closingRes;
        newSession.assets.turns = turnsRes;

    } catch (e) {
        console.error(`[Session ${sessionId}] Asset generation warning:`, e);
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

    // INITIALIZATION LOGIC (Auto-Start on TV Connect)
    const now = Date.now();
    if (!session.tv_connected_at) {
        session.tv_connected_at = now;
        session.phase_start_time = now;
    }

    let event = {};
    const elapsed = now - session.phase_start_time;

    // A. Priority Queue (Dynamic Responses / Answers)
    if (session.next_action_queue.length > 0) {
        if (session.current_phase === PHASES.ANSWER) {
            // Wait sufficient time for answer playback (e.g., 12s buffer logic handled in frontend usually, but here we force hold)
            if (elapsed < 12000) {
                // Keep waiting
            } else {
                session.current_phase = PHASES.GIFT_REVEAL;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
        } else {
            // Pop new event
            event = session.next_action_queue.shift();
            session.current_phase = event.phase; // Should be ANSWER
            session.phase_start_time = now;
            return event;
        }
    }

    // B. State Machine Flow
    switch (session.current_phase) {
        case PHASES.INTRO:
            const intro = session.assets.intro || { tts_audio_url: null, duration_ms: 15000 };
            const safeIntroDuration = Math.max(intro.duration_ms || 0, 15000); // 15s forced minimum

            if (elapsed < (safeIntroDuration + 1000)) {
                event = {
                    phase: PHASES.INTRO,
                    king: KINGS[0],
                    subtitle_text: SCRIPTS.INTRO,
                    tts_audio_url: intro.tts_audio_url,
                    duration_ms: safeIntroDuration,
                    animation_cue: 'talk_happy',
                    should_open_question_window: false
                };
            } else {
                session.current_phase = PHASES.TURN_START;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
            break;

        case PHASES.TURN_START:
            const pIndex = session.current_participant_index;
            const turnAudio = (session.assets.turns && session.assets.turns[pIndex])
                ? session.assets.turns[pIndex]
                : { tts_audio_url: null, duration_ms: 4000 };

            if (elapsed < (turnAudio.duration_ms + 2000)) {
                const p = session.participants[pIndex];
                const king = KINGS[session.current_king_index % 3];
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
            } else {
                session.current_phase = PHASES.QUESTION_WINDOW;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
            break;

        case PHASES.QUESTION_WINDOW:
            const listening = session.assets.listening || { tts_audio_url: null, duration_ms: 3000 };
            event = {
                phase: PHASES.QUESTION_WINDOW,
                king: KINGS[session.current_king_index % 3],
                subtitle_text: SCRIPTS.LISTENING,
                tts_audio_url: listening.tts_audio_url, // Now plays audio!
                animation_cue: "idle",
                should_open_question_window: true
            };
            break;

        case PHASES.ANSWER:
            // Fallback timeout
            if (elapsed > 12000) {
                session.current_phase = PHASES.GIFT_REVEAL;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
            event = {
                phase: PHASES.ANSWER,
                king: KINGS[session.current_king_index % 3],
                subtitle_text: "...",
                animation_cue: "talk_happy"
            };
            break;

        case PHASES.GIFT_REVEAL:
            const giftAudio = session.assets.gift || { tts_audio_url: null, duration_ms: 4000 };

            if (elapsed < (giftAudio.duration_ms + 2000)) {
                const gift = session.gifts.find(g => g.person === session.participants[session.current_participant_index].name);
                event = {
                    phase: PHASES.GIFT_REVEAL,
                    king: KINGS[session.current_king_index % 3],
                    subtitle_text: `Mira... ${gift ? gift.label : 'un regalo'} para ti.`,
                    tts_audio_url: giftAudio.tts_audio_url, // Now plays audio!
                    animation_cue: 'point',
                    should_open_question_window: false
                };
            } else {
                session.current_participant_index++;
                if (session.current_participant_index >= session.participants.length) {
                    session.current_phase = PHASES.CLOSING;
                } else {
                    session.current_phase = PHASES.TURN_START;
                    session.current_king_index++;
                }
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
            break;

        case PHASES.CLOSING:
            const closing = session.assets.closing || { tts_audio_url: null, duration_ms: 10000 };
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
