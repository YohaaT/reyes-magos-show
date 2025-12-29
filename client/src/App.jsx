import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import TV from './pages/TV';
import Mobile from './pages/Mobile';

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:sessionId" element={<SessionDispatcher />} />
      </Routes>
    </div>
  );
}

import { useSearchParams, useParams } from 'react-router-dom';

function SessionDispatcher() {
  const { sessionId } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');

  if (mode === 'tv') return <TV sessionId={sessionId} />;
  if (mode === 'mic') return <Mobile sessionId={sessionId} />;

  return <div className="p-10 text-center">Modo desconocido. Usa los enlaces generados.</div>;
}

export default App;
