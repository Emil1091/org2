# Setup de Supabase

Pasos manuales, una sola vez, en el dashboard del proyecto (supabase.com):

1. **Schema**: SQL Editor → pegar el contenido de `schema.sql` → Run.
2. **Auth → Providers**: confirmar que "Email" está habilitado (magic link / OTP viene activado por defecto).
3. **Auth → Settings**: desactivar "Allow new users to sign up". Sin esto, cualquier email puede crearse una cuenta sola.

> El login usa el link clickeable del email (no un código de 6 dígitos: editar la plantilla de email requiere plan Pro). Si pedís un link nuevo para el mismo email, el anterior queda invalidado — no pidas dos antes de hacer clic en el primero. El servicio de email gratuito de Supabase además tiene un límite bajo de envíos por hora; si da "email rate limit exceeded", esperar a que se resetee o configurar SMTP propio (Auth → Settings → SMTP Settings, ej. con Resend).
4. **Auth → URL Configuration**: agregar `http://localhost:5173` (y el puerto que use `npm run dev`, ej. `5174`) a "Redirect URLs". Cuando se haga el deploy a Vercel, agregar también esa URL de producción.
5. **Auth → Users → Invite user**: invitar a cada compañero del equipo por su email. Solo los invitados van a poder entrar.
6. **Settings → API**: copiar `Project URL` y `anon public` key, y cargarlas en el `.env` local (ver `.env.example`).

Sin estos pasos la app no tiene con qué conectarse — `src/lib/supabaseClient.ts` tira un error claro si faltan las env vars.
