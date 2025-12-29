import { useState, useRef, useEffect } from 'react';

export default function useAudioRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);

    // Constants
    const SILENCE_THRESHOLD = 25; // Tunable (0-255)
    const SILENCE_DURATION = 800; // ms
    const MAX_DURATION = 14000; // ms

    const startVAD = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;

            // Init MediaRecorder
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                audioChunksRef.current = [];
                setIsRecording(false);
                setIsSpeaking(false);
                cleanup();
            };

            // Start Analysis Loop
            analyze();

        } catch (e) {
            console.error("Error accessing mic", e);
        }
    };

    const cleanup = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        if (audioContextRef.current) audioContextRef.current.close();
    };

    const analyze = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS-like volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > SILENCE_THRESHOLD) {
            // Voice Detected
            if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
                // Start Recording if not already
                startRecording();
            }

            setIsSpeaking(true);
            // Clear silence timer
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else {
            // Silence
            setIsSpeaking(false);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                if (!silenceTimerRef.current) {
                    silenceTimerRef.current = setTimeout(() => {
                        stopRecording();
                    }, SILENCE_DURATION);
                }
            }
        }

        rafRef.current = requestAnimationFrame(analyze);
    };

    const startRecording = () => {
        console.log("Starting Recording...");
        setIsRecording(true);
        audioChunksRef.current = [];
        if (mediaRecorderRef.current) mediaRecorderRef.current.start();

        // Hard stop
        setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                stopRecording();
            }
        }, MAX_DURATION);
    };

    const stopRecording = () => {
        console.log("Stopping Recording...");
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    return {
        startVAD,
        isRecording,
        isSpeaking,
        audioBlob,
        resetAudio: () => setAudioBlob(null)
    };
}
