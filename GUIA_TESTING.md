# Guía de Pruebas Incrementales - Reyes Magos MVP

Sigue estos pasos para validar que el sistema funciona correctamente.

## Fase V0: Test de Flujo (Mocks)
**Objetivo:** Verificar que las piezas se comunican (Frontend <-> Backend) y la lógica de sesión avanza.

1.  **Iniciar Aplicación**:
    Ejecuta el archivo `start_project.bat` en el escritorio (o `npm run dev` en terminal).
    Espera a que diga "Server running on port 3000" y "VITE ... http://localhost:5173".

2.  **Crear Sesión**:
    - Abre `http://localhost:5173`.
    - Rellena el formulario (Nombre: "Ana", Regalo: "Bici").
    - Pulsa "Crear Experiencia".
    - Verás dos enlaces.

3.  **Probar TV**:
    - Haz clic en el enlace de TV.
    - **IMPORTANTE**: Haz clic en la pantalla negra "Modo TV" para activar el audio.
    - ¿Ves al Rey Avatar y escuchas la intro? -> ✅ OK

4.  **Probar Móvil & Voz**:
    - Abre el enlace MÓVIL (en una pestaña nueva o en tu móvil real si estás en red local).
    - Pulsa "Activar Magia".
    - Espera a que la TV diga "¿Estáis listos?" y pase a la fase de preguntas (Avatar feliz/esperando).
    - En el móvil: Habla fuerte.
    - El móvil debe pasar a "Enviando...".
    - Mira la consola/terminal donde corre el servidor. Deberías ver logs como:
      `[🔍 TEST STEP 1: STT] Recibido Audio...`
    - La TV debe mostrar subtítulos: "Tenemos muchísimos camellos..." y reproducir audio. -> ✅ OK

---

## Fase V1: Conectar Google STT (Real)
Una vez V0 funcione, conectaremos el reconocimiento de voz real.

**Requisitos**: Archivo JSON de credenciales de Google Cloud (Service Account).
1. Pon el archivo JSON en la carpeta del proyecto.
2. Edita `server/config.js` y apunta `GOOGLE_APPLICATION_CREDENTIALS` a ese archivo.
3. Yo reemplazaré el código "Mock" en `audio.js` por el real.

## Fase V2: Conectar OpenAI (Cerebro)
**Requisitos**: API Key de OpenAI.
1. Edita `server/config.js` o crea un archivo `.env` con `OPENAI_API_KEY=sk-...`.
2. Yo implementaré la llamada real al LLM.

## Fase V3: Conectar AWS Polly (Voz Neural)
**Requisitos**: AWS Access Key + Secret (Permisos PollyFullAccess).
1. Edita `server/config.js` con tus claves AWS.
2. Yo habilitaré la síntesis de voz real.
