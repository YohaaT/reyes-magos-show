import { useState, useEffect } from 'react';
import useAudioRecorder from '../hooks/useAudioRecorder';
import { uploadAudio, transcribeAudio, replyToQuestion } from '../services/api'; // Fix import path
import { Mic, Loader, Send } from 'lucide-react';

export default function Mobile({ sessionId }) {
    const { startVAD, isRecording, isSpeaking, audioBlob, resetAudio } = useAudioRecorder();
    const [status, setStatus] = useState('idle'); // idle, listening, processing, sent
    const [logs, setLogs] = useState([]);

    const addLog = (msg) => setLogs(prev => [msg, ...prev]);

    useEffect(() => {
        if (audioBlob) {
            processAudio(audioBlob);
        }
    }, [audioBlob]);

    const processAudio = async (blob) => {
        try {
            setStatus('processing');
            addLog('Audio capturado. Subiendo...');

            // 1. Upload
            // Using a dummy person ID for MVP, real app would know who is asking or default
            const { audio_id } = await uploadAudio(sessionId, 'default_person', blob);
            addLog(`Audio ID: ${audio_id}`);

            // 2. Transcribe
            addLog('Transcribiendo...');
            const { text } = await transcribeAudio(sessionId, audio_id);
            addLog(`Texto: "${text}"`);

            // 3. Reply
            addLog('Enviando a los Reyes...');
            const result = await replyToQuestion({
                session_id: sessionId,
                user_input: { type: 'question_text', text },
                // other required fields by contract would go here (dummy for MVP)
                king: 'GASPAR',
                phase: 'QUESTION_WINDOW'
            });

            addLog('Respuesta generada. Mira la TV.');
            setStatus('sent');
            resetAudio();

            // Reset to idle after a moment
            setTimeout(() => setStatus('listening'), 3000); // Auto re-arm or manual?

            // Re-arm VAD? 
            // Spec says: "Envía audio al backend solo durante QUESTION_WINDOW".
            // The backend should tell us if we can ask again.
            // Ideally we poll session status here too to enable/disable mic. 
            // For MVP, just let them talk.

        } catch (e) {
            console.error(e);
            addLog('Error: ' + e.message);
            setStatus('idle');
        }
    };

    const handleActivate = () => {
        startVAD();
        setStatus('listening');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-6">
            <header className="mb-8 w-full">
                <h1 className="text-xl font-bold text-center text-amber-500">Mando Mágico</h1>
            </header>

            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm">

                {status === 'idle' && (
                    <button
                        onClick={handleActivate}
                        className="w-48 h-48 rounded-full bg-slate-800 border-4 border-slate-600 flex flex-col items-center justify-center shadow-lg active:scale-95 transition"
                    >
                        <Mic size={48} className="text-slate-400 mb-2" />
                        <span className="text-slate-300 font-bold">Activar Magia</span>
                    </button>
                )}

                {status === 'listening' && (
                    <div className={`w-48 h-48 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-200 ${isRecording ? 'bg-red-900/50 border-red-500 shadow-[0_0_30px_red]' : 'bg-slate-800 border-amber-500/50'
                        }`}>
                        {isRecording ? (
                            <>
                                <div className="animate-pulse w-3 h-3 bg-red-500 rounded-full mb-4"></div>
                                <span className="text-red-300 font-bold">Te escuchan...</span>
                            </>
                        ) : (
                            <>
                                <Mic size={48} className="text-amber-500 mb-2" />
                                <span className="text-amber-300 text-sm">Habla fuerte...</span>
                                {isSpeaking && <span className="text-xs text-green-400 mt-1">Voz detectada</span>}
                            </>
                        )}
                    </div>
                )}

                {status === 'processing' && (
                    <div className="w-48 h-48 rounded-full bg-slate-800 border-4 border-blue-500/50 flex flex-col items-center justify-center animate-pulse">
                        <Loader className="animate-spin text-blue-400 mb-2" size={32} />
                        <span className="text-blue-300 text-sm">Enviando...</span>
                    </div>
                )}

                {status === 'sent' && (
                    <div className="w-48 h-48 rounded-full bg-green-900/30 border-4 border-green-500 flex flex-col items-center justify-center">
                        <Send className="text-green-400 mb-2" size={32} />
                        <span className="text-green-300 font-bold">¡Enviado!</span>
                    </div>
                )}

            </div>

            <div className="w-full mt-8 bg-slate-950 p-4 rounded text-xs font-mono text-slate-500 h-32 overflow-y-auto">
                {logs.map((l, i) => <div key={i}>&gt; {l}</div>)}
            </div>
        </div>
    );
}
