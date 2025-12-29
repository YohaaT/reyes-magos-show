# Reyes Magos Voice Show - MVP (Production Ready)

## Requisitos
- Node.js (v16+)
- Navegador moderno (Chrome/Edge)
- Smartphone en la misma red (recomendado)

## Instalación
Desde la raíz del proyecto:
1. Instalar dependencias del servidor:
   ```bash
   npm install
   ```
2. Instalar dependencias del cliente:
   ```bash
   cd client
   npm install
   cd ..
   ```

## Configuración
1. Renombra `server/.env.example` a `server/.env` (si existe) o configura `server/config.js` con tus claves reales:
   - `OPENAI_API_KEY`
   - `GOOGLE_APPLICATION_CREDENTIALS` (Ruta al JSON)
   - `AWS_ACCESS_KEY_ID` / `SECRET` (Para Polly)
   
   *Nota: En este MVP, el sistema usa mocks (simulaciones) para STT/LLM/TTS si no se proveen credenciales, para que puedas probar el flujo inmediatamente.*

## Ejecución
Para iniciar todo (Frontend + Backend), ejecuta:

```bash
npm start
```

O manualmente:
- Terminal 1 (Backend): `node server/index.js` (Puerto 3000)
- Terminal 2 (Frontend): `cd client && npm run dev` (Puerto 5173)

## Uso
1. Abre `http://localhost:5173`.
2. Completa el formulario de "Configuración de Sesión".
3. Al crear la sesión, verás dos enlaces:
   - **TV**: Abre este enlace en tu ordenador o Smart TV. Verás al Rey Mago esperando.
   - **Móvil**: Abre este enlace en tu móvil.
4. En el móvil, pulsa "Activar Magia".
5. Cuando sea tu turno (según la TV), habla al móvil.
   - La TV indicará cuándo es el momento de preguntar.
   - El sistema usará VAD para detectar tu voz y responderá a través de la TV.

## Estructura del Proyecto
- `/server`: API Node.js, gestor de sesiones y orquestador de IA.
- `/client`: Frontend React + Vite con modos TV y Mobile.
- `/client/src/hooks/useAudioRecorder.js`: Lógica de VAD (Voice Activity Detection).

## Notas de Producción
- El audio se graba en WebM/Opus.
- La persistencia de sesión es en memoria (se pierde al reiniciar el servidor).
- Para producción real, configurar SSL (HTTPS) es obligatorio para que el micrófono funcione en móviles fuera de localhost.
