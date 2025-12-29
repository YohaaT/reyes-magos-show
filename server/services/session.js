const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// In-memory session store
const sessions = new Map();

// Phases (SIMPLIFIED: No Intro Phase)
const PHASES = {
    TURN_START: 'TURN_START',
    // INTRO deleted, merged into TURN_START for first user
    QUESTION_WINDOW: 'QUESTION_WINDOW',
    ANSWER: 'ANSWER',
    GIFT_REVEAL: 'GIFT_REVEAL',
    CLOSING: 'CLOSING'
};

const KINGS = ['MELCHOR', 'GASPAR', 'BALTASAR'];

const SCRIPTS = {
    INTRO: "¡Hola! Somos los Reyes Magos. Hemos viajado desde muy lejos siguiendo la estrella. ", // Space at end
    LISTENING: "Te escuchamos con atención...",
    GIFT: "¡Mira lo que ha aparecido! Es un regalo mágico.",
    CLOSING: "Ha sido maravilloso visitaros. ¡Sed muy buenos! ¡Hasta el año que viene!"
};

async function createSession(data) {
    const sessionId = uuidv4();
    const audioService = require('./audio');

    // 1. Prepare Session Data
    const newSession = {
        id: sessionId,
        created_at: Date.now(),
        pack: data.pack || 'basic',
        participants: data.participants || [],
        gifts: data.gifts || [],
        settings: data.settings || {},

        // Initial Phase is TURN_START directly
        current_phase: PHASES.TURN_START,
        phase_start_time: 0,
        tv_connected_at: 0,

        current_king_index: 0,
        current_participant_index: 0,
        questions_used_for_person: 0,
        next_action_queue: [],

        assets: {
            listening: null,
            gift: null,
            closing: null,
            turns: []
        }
    };

    // 2. Pre-generate Audios (MERGED INTRO STRATEGY)
    console.log(`[Session ${sessionId}] Pre-generating assets...`);

    // Static assets
    const pListening = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.LISTENING);
    const pGift = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.GIFT);
    const pClosing = audioService.generateTTS(sessionId, 'Sergio', SCRIPTS.CLOSING);

    // Dynamic Turns
    const pTurns = newSession.participants.map((p, index) => {
        const king = KINGS[index % 3];
        const voiceId = 'Sergio';

        let text = `¡${p.name}! La estrella nos habló de ti...`;

        // IF FIRST PARTICIPANT: Prepend the Intro!
        if (index === 0) {
            text = SCRIPTS.INTRO + " " + text;
        }

        return audioService.generateTTS(sessionId, voiceId, text);
    });

    try {
        const [listRes, giftRes, closingRes, ...turnsRes] = await Promise.all([pListening, pGift, pClosing, ...pTurns]);

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

    const now = Date.now();
    if (!session.tv_connected_at) {
        session.tv_connected_at = now;
        session.phase_start_time = now;
    }

    let event = {};
    const elapsed = now - session.phase_start_time;

    // A. Priority Queue
    if (session.next_action_queue.length > 0) {
        if (session.current_phase === PHASES.ANSWER) {
            // 12s hold for answer
            if (elapsed < 12000) {
                // wait
            } else {
                session.current_phase = PHASES.GIFT_REVEAL;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
        } else {
            event = session.next_action_queue.shift();
            session.current_phase = event.phase;
            session.phase_start_time = now;
            return event;
        }
    }

    // B. State Machine Flow
    switch (session.current_phase) {
        // CASE INTRO REMOVED - DIRECTLY TO TURN_START

        case PHASES.TURN_START:
            const pIndex = session.current_participant_index;
            const turnAudio = (session.assets.turns && session.assets.turns[pIndex])
                ? session.assets.turns[pIndex]
                : { tts_audio_url: null, duration_ms: 6000 };

            // Allow full duration + buffer
            if (elapsed < (turnAudio.duration_ms + 2000)) {
                const p = session.participants[pIndex];
                const king = KINGS[session.current_king_index % 3];

                let welcomeText = `¡${p.name}! La estrella nos habló de ti...`;
                if (pIndex === 0) {
                    welcomeText = SCRIPTS.INTRO + " " + welcomeText;
                }

                event = {
                    phase: PHASES.TURN_START,
                    king: king,
                    subtitle_text: welcomeText,
                    tts_audio_url: turnAudio.tts_audio_url,
                    duration_ms: turnAudio.duration_ms,
                    animation_cue: 'talk_happy',
                    should_open_question_window: true,
                    // Give simpler window instructions
                    question_window_seconds: 0
                };
            } else {
                session.current_phase = PHASES.QUESTION_WINDOW;
                session.phase_start_time = now;
                return getNextState(sessionId);
            }
            break;

        case PHASES.QUESTION_WINDOW:
            const listening = session.assets.listening || { tts_audio_url: null, duration_ms: 3000 };
            // Use 5s hold for "Listening" instructions then just stay idle
            if (elapsed < (listening.duration_ms + 1000)) {
                event = {
                    phase: PHASES.QUESTION_WINDOW,
                    king: KINGS[session.current_king_index % 3],
                    subtitle_text: SCRIPTS.LISTENING,
                    tts_audio_url: listening.tts_audio_url,
                    animation_cue: "idle",
                    should_open_question_window: true
                };
            } else {
                // Remain in QUESTION_WINDOW but maybe stop playing audio (or keep returning same event is ok, frontend handles dedupe)
                event = {
                    phase: PHASES.QUESTION_WINDOW,
                    king: KINGS[session.current_king_index % 3],
                    subtitle_text: SCRIPTS.LISTENING,
                    // Avoid sending audio URL again to prevent loop? 
                    // Frontend usually blocks re-play if same URL.
                    tts_audio_url: listening.tts_audio_url,
                    animation_cue: "idle",
                    should_open_question_window: true
                };
            }
            break;

        case PHASES.ANSWER:
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
                    tts_audio_url: giftAudio.tts_audio_url,
                    animation_cue: 'point',
                    should_open_question_window: false
                };
            } else {
                session.current_participant_index++;
                if (session.current_participant_index >= session.participants.length) {
                    session.current_phase = PHASES.CLOSING;
                } else {
                    session.current_phase = PHASES.TURN_START; // Loops back to next child
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
