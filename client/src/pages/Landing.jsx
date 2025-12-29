import { useState } from 'react';
import { createSession } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [pack, setPack] = useState('basic');
    const [participants, setParticipants] = useState([
        { name: '', age_group: 'child', tagline: '', gift: 'Un juguete sorpresa' }
    ]);
    const [createdLinks, setCreatedLinks] = useState(null);

    const addParticipant = () => {
        setParticipants([...participants, { name: '', age_group: 'child', tagline: '', gift: '' }]);
    };

    const updateParticipant = (index, field, value) => {
        const newP = [...participants];
        newP[index][field] = value;
        setParticipants(newP);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Transform local state to API contract
            const apiParticipants = participants.map(p => ({
                name: p.name,
                age_group: p.age_group,
                tagline_optional: p.tagline
            }));

            const apiGifts = participants.map(p => ({
                person: p.name,
                label: p.gift,
            }));

            const payload = {
                pack,
                language: 'es',
                participants: apiParticipants,
                gifts: apiGifts,
                settings: { stylePack: 'familiar_emotivo' }
            };

            const result = await createSession(payload);
            setCreatedLinks(result);
        } catch (err) {
            alert('Error creando sesión: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (createdLinks) {
        return (
            <div className="max-w-2xl mx-auto p-8 space-y-6">
                <h1 className="text-3xl font-bold text-amber-400">¡Sesión Aprobada!</h1>
                <div className="bg-slate-900 p-6 rounded-lg border border-slate-700 space-y-4">
                    <div>
                        <p className="text-slate-400 text-sm">PARA LA TELEVISIÓN (Abrir en pantalla grande)</p>
                        <a href={createdLinks.tv_url} target="_blank" className="text-blue-400 hover:underline text-lg break-all">
                            {createdLinks.tv_url}
                        </a>
                    </div>
                    <div className="border-t border-slate-800 pt-4">
                        <p className="text-slate-400 text-sm">PARA EL MÓVIL (Abrir en smartphone)</p>
                        <a href={createdLinks.mobile_url} target="_blank" className="text-green-400 hover:underline text-lg break-all">
                            {createdLinks.mobile_url}
                        </a>
                    </div>
                </div>
                <button onClick={() => setCreatedLinks(null)} className="text-slate-500 hover:text-white">
                    Volver
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-10">
            <header className="mb-10 text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-300 to-yellow-600 bg-clip-text text-transparent">
                    Reyes Magos Voice Show
                </h1>
                <p className="text-slate-400 mt-2">Configura la experiencia mágica para tu hogar</p>
            </header>

            <form onSubmit={handleSubmit} className="space-y-8 bg-slate-900/50 p-6 rounded-xl border border-slate-800">

                {/* Pack Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Nivel de Experiencia</label>
                    <div className="grid grid-cols-3 gap-4">
                        {['basic', 'standard', 'premium'].map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPack(p)}
                                className={`p-3 rounded border capitalize ${pack === p
                                        ? 'bg-amber-900/30 border-amber-500 text-amber-100'
                                        : 'bg-slate-800 border-transparent text-slate-400 hover:bg-slate-800/80'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Participants */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-300">Participantes (Niños/Adultos)</label>
                        <button type="button" onClick={addParticipant} className="text-amber-400 text-sm hover:text-amber-300">+ Agregar</button>
                    </div>

                    {participants.map((p, idx) => (
                        <div key={idx} className="p-4 bg-slate-800 rounded border border-slate-700 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    placeholder="Nombre (ej. Ana)"
                                    required
                                    className="bg-slate-900 border border-slate-700 rounded p-2"
                                    value={p.name}
                                    onChange={e => updateParticipant(idx, 'name', e.target.value)}
                                />
                                <select
                                    className="bg-slate-900 border border-slate-700 rounded p-2"
                                    value={p.age_group}
                                    onChange={e => updateParticipant(idx, 'age_group', e.target.value)}
                                >
                                    <option value="child">Niño/a</option>
                                    <option value="teen">Adolescente</option>
                                    <option value="adult">Adulto</option>
                                </select>
                            </div>
                            <input
                                placeholder="Regalo clave (ej. Bicicleta roja)"
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2"
                                value={p.gift}
                                onChange={e => updateParticipant(idx, 'gift', e.target.value)}
                            />
                            <input
                                placeholder="Detalle extra (ej. 'Se ha portado muy bien pero...')"
                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm"
                                value={p.tagline}
                                onChange={e => updateParticipant(idx, 'tagline', e.target.value)}
                            />
                        </div>
                    ))}
                </div>

                <button
                    disabled={loading}
                    type="submit"
                    className="w-full py-4 bg-gradient-to-r from-amber-600 to-yellow-600 rounded font-bold text-lg hover:from-amber-500 hover:to-yellow-500 transition disabled:opacity-50"
                >
                    {loading ? 'Preparando la magia...' : 'Crear Experiencia'}
                </button>

            </form>
        </div>
    );
}
