import axios from 'axios';

const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const baseURL = isProd ? '/api' : 'http://localhost:3000/api';

const api = axios.create({
    baseURL: baseURL,
});

export const createSession = async (data) => {
    const response = await api.post('/session/create', data);
    return response.data;
};

export const getNextEvent = async (sessionId) => {
    const response = await api.post('/session/next', { session_id: sessionId });
    return response.data;
};

export const uploadAudio = async (sessionId, personId, audioBlob) => {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('person_id', personId);
    formData.append('audio_file', audioBlob, 'voice.webm');

    const response = await api.post('/audio/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
};

export const transcribeAudio = async (sessionId, audioId) => {
    const response = await api.post('/stt', { session_id: sessionId, audio_id: audioId });
    return response.data;
};

export const replyToQuestion = async (payload) => {
    const response = await api.post('/reply', payload);
    return response.data;
};

export default api;
