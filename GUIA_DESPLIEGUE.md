# Reyes Magos Voice Show - Despliegue en la Nube

Para que el proyecto funcione desde cualquier dispositivo (con HTTPS para el micrófono), la forma más fácil y rápida es desplegarlo en **Vercel**.

## Pasos para Desplegar (5 minutos)

### 1. Preparar Subida
1.  Si no tienes git, inicialízalo:
    ```bash
    git init
    git add .
    git commit -m "MVP Ready for Vercel"
    ```
2.  Sube este código a un repositorio en **GitHub**.

### 2. Desplegar en Vercel
1.  Entra en [vercel.com](https://vercel.com) y regístrate (es gratis).
2.  Haz clic en "Add New..." -> "Project".
3.  Importa tu repositorio de GitHub.
4.  **Configuración del Framework**:
    *   Vercel detectará `Vite`.
    *   Asegúrate de que el **Root Directory** está marcado como `./` (la raíz del proyecto, NO `client`).
    *   Si te pide comando de build, déjalo por defecto (usa la configuración `vercel.json` que he creado).
5.  **Variables de Entorno**:
    Añade las claves de API (para cuando actives la IA real):
    *   `OPENAI_API_KEY`: ...
    *   `AWS_ACCESS_KEY_ID`: ...
    *   `AWS_SECRET_ACCESS_KEY`: ...
    *   `GOOGLE_APPLICATION_CREDENTIALS`: (Esto requiere un paso extra, mejor usa base64 o similar para servidor).
6.  Pulsa **Deploy**.

### 3. ¡Listo!
Vercel te dará una URL tipo `https://reyes-magos-show.vercel.app`.
*   Entra desde tu móvil.
*   Crea sesión.
*   ¡El micrófono funcionará perfectamente gracias al HTTPS automático!
