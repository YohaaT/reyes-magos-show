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

// Default Scripts (Pre-loaded text for TTS)
// In a real app, these would be in a DB or config file with variations.
const SCRIPTS = {
    INTRO: "¡Hola! Somos los Reyes Magos. Hemos viajado desde muy lejos siguiendo la estrella.",
    RULES: "Antes de entregar los regalos, queremos hablar un poco con vosotros. ¿Estáis listos?",
    CLOSING: "Ha sido maravilloso visitaros. ¡Sed muy buenos! ¡Hasta el año que viene!"
};

async function createSession(data) {
    const sessionId = uuidv4();

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
        used_magical_long_for_person: false,

        // Store last generated event to ensure idempotency if needed, or simple flow
        next_action_queue: []
    };

    sessions.set(sessionId, newSession);

    // In production (Vercel), we want to use the actual host header if possible, or fallback manually.
    // However, FRONTEND_URL in config might be hardcoded. 
    // Best practice for Lambda/Vercel: construct from request headers if available in creating session.
    // For MVP, we stick to config, but user must update config.js in Prod.
    // ALTERNATIVE: Return relative paths and let frontend resolve them? No, we need shareable links.

    // Use the origin from the request if available (for Vercel/Web clients), otherwise fallback to config
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

    // Simple State Machine Logic
    // This is called when TV finishes previous action and asks "What's next?"

    let event = {};

    // If we have a queued action (e.g. from an Answer), return it
    if (session.next_action_queue.length > 0) {
        event = session.next_action_queue.shift();
        // Update phase if the event dictates it
        // (In a full implementation, events would carry state transition info)
        return event;
    }

    // Otherwise, calculate next step based on current phase
    switch (session.current_phase) {
        case PHASES.INTRO:
            event = {
                phase: PHASES.INTRO,
                king: KINGS[0],
                subtitle_text: SCRIPTS.INTRO,
                tts_audio_url: `${config.BASE_URL}/audio/intro_demo.mp3`, // Placeholder
                animation_cue: 'talk_happy',
                should_open_question_window: false,
                question_window_seconds: 0
            };
            // Advance Phase for next call
            session.current_phase = PHASES.RULES;
            break;

        case PHASES.RULES:
            event = {
                phase: PHASES.RULES,
                king: KINGS[1],
                subtitle_text: SCRIPTS.RULES,
                tts_audio_url: `${config.BASE_URL}/audio/rules_demo.mp3`,
                animation_cue: 'talk_solemn',
                should_open_question_window: false
            };
            session.current_phase = PHASES.TURN_START;
            break;

        case PHASES.TURN_START:
            const p = session.participants[session.current_participant_index];
            const king = KINGS[session.current_king_index % 3];
            event = {
                phase: PHASES.TURN_START,
                king: king,
                subtitle_text: `¡${p.name}! La estrella nos habló de ti...`,
                tts_audio_url: `${config.BASE_URL}/audio/turn_start.mp3`, // Dynamic generation in real app
                animation_cue: 'talk_happy',
                should_open_question_window: true,
                question_window_seconds: session.pack === 'basic' ? 12 : 15
            };
            // Next expectation: User asks question -> /reply endpoint handles it and sets next phase/queue
            session.current_phase = PHASES.QUESTION_WINDOW;
            break;

        case PHASES.QUESTION_WINDOW:
            // Logic: Waiting for user input. 
            // If this is called, it might mean timeout or polling.
            // For MVP, if TV calls this, maybe we just keep waiting or hint?
            // Or, if /reply was called, `session.next_action_queue` would have the ANSWER.
            // If empty, return status loop or "Waiting"
            event = {
                phase: PHASES.QUESTION_WINDOW,
                king: KINGS[session.current_king_index % 3],
                subtitle_text: "Te escuchamos...",
                animation_cue: "idle",
                should_open_question_window: true
            };
            break;

        case PHASES.ANSWER:
            // Handled via queue usually, but if we fall through:
            session.current_phase = PHASES.GIFT_REVEAL; // Auto advance
            return getNextState(sessionId); // Recursion to get gift

        case PHASES.GIFT_REVEAL:
            const gift = session.gifts.find(g => g.person === session.participants[session.current_participant_index].name);
            event = {
                phase: PHASES.GIFT_REVEAL,
                king: KINGS[session.current_king_index % 3],
                subtitle_text: `Mira... ${gift ? gift.label : 'un regalo'} para ti.`,
                tts_audio_url: `${config.BASE_URL}/audio/gift.mp3`,
                animation_cue: 'point',
                should_open_question_window: false
            };

            // Advance participant or end
            session.current_participant_index++;
            if (session.current_participant_index >= session.participants.length) {
                session.current_phase = PHASES.CLOSING;
            } else {
                session.current_phase = PHASES.TURN_START;
                session.current_king_index++;
            }
            break;

        case PHASES.CLOSING:
            event = {
                phase: PHASES.CLOSING,
                king: KINGS[1],
                subtitle_text: SCRIPTS.CLOSING,
                tts_audio_url: `${config.BASE_URL}/audio/closing.mp3`,
                animation_cue: 'wave',
                should_open_question_window: false
            };
            // End state
            break;
    }

    return event;
}

module.exports = {
    createSession,
    getNextState,
    sessions // Export for other services to access
};
