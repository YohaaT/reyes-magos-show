import { useEffect, useState, useRef } from 'react';
import { getNextEvent } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function TV({ sessionId }) {
    const [currentEvent, setCurrentEvent] = useState(null);
    const [subtitle, setSubtitle] = useState('');
    const [king, setKing] = useState('MELCHOR');
    const [animation, setAnimation] = useState('idle');

    const audioRef = useRef(null);
    const pollingRef = useRef(null);
    const lastPhaseRef = useRef(null);
    const lastAudioRef = useRef(null);

    useEffect(() => {
        // Start Polling
        const poll = async () => {
            try {
                const event = await getNextEvent(sessionId);

                // Simple diffing to see if we have a new "Action"
                const isNewAudio = event.tts_audio_url && event.tts_audio_url !== lastAudioRef.current;
                const isNewPhase = event.phase !== lastPhaseRef.current;

                if (isNewPhase || isNewAudio) {
                    setCurrentEvent(event);
                    lastPhaseRef.current = event.phase;

                    if (event.subtitle_text) setSubtitle(event.subtitle_text);
                    if (event.king) setKing(event.king);
                    if (event.animation_cue) setAnimation(event.animation_cue);

                    if (isNewAudio) {
                        lastAudioRef.current = event.tts_audio_url;
                        if (audioRef.current) {
                            audioRef.current.src = event.tts_audio_url;
                            audioRef.current.play().catch(e => console.error("Autoplay prevent?", e));
                        }
                    }
                }
            } catch (err) {
                console.error("Polling error", err);
            }
            pollingRef.current = setTimeout(poll, 2000); // 2s poll for MVP
        };

        poll();
        return () => clearTimeout(pollingRef.current);
    }, [sessionId]);

    const [started, setStarted] = useState(false);

    if (!started) {
        return (
            <div
                onClick={() => {
                    setStarted(true);
                    if (audioRef.current) audioRef.current.play().catch(() => { });
                }}
                className="h-screen w-screen flex items-center justify-center bg-black text-white cursor-pointer"
            >
                <div className="text-center p-10 border border-white/20 rounded-xl bg-white/10 hover:bg-white/20 transition">
                    <h1 className="text-2xl font-bold mb-2">Modo TV</h1>
                    <p className="text-sm text-gray-300">Haz click para iniciar (Permiso de Audio)</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-black overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1576014131341-c1f251ccead3?q=80&w=2000&auto=format&fit=crop')] bg-cover opacity-30"></div>

            {/* Audio Element Hidden */}
            <audio ref={audioRef} onEnded={() => setAnimation('idle')} />

            {/* Avatar Container */}
            <div className="relative z-10 w-full max-w-4xl aspect-video flex items-center justify-center">
                {/* Placeholder Avatar */}
                <Avatar king={king} animation={animation} />
            </div>

            {/* Subtitles */}
            <AnimatePresence mode="wait">
                {subtitle && (
                    <motion.div
                        key={subtitle}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute bottom-20 z-20 w-full max-w-5xl text-center px-4"
                    >
                        <p className="text-3xl md:text-5xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-tight font-serif">
                            {subtitle}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Debug for MVP */}
            <div className="absolute top-4 left-4 text-xs text-white/30">
                Phase: {currentEvent?.phase} | King: {king}
            </div>
        </div>
    );
}

function Avatar({ king, animation }) {
    // Simple visual representation
    const colors = {
        MELCHOR: 'bg-yellow-600',
        GASPAR: 'bg-red-700',
        BALTASAR: 'bg-purple-700'
    };

    return (
        <motion.div
            animate={animation === 'talk_happy' ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ repeat: animation.startsWith('talk') ? Infinity : 0, duration: 0.5 }}
            className={`w-64 h-64 md:w-96 md:h-96 rounded-full border-4 border-amber-500 shadow-[0_0_50px_rgba(255,200,0,0.3)] flex items-center justify-center ${colors[king] || 'bg-gray-500'}`}
        >
            <div className="text-center">
                <div className="text-6xl font-serif text-amber-100">{king[0]}</div>
                <div className="text-xl text-amber-200 mt-2">{king}</div>
                <div className="text-sm text-white/50 mt-4 font-mono">{animation}</div>
            </div>
        </motion.div>
    );
}
