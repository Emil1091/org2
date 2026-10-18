# Setup de Supabase

Pasos manuales, una sola vez, en el dashboard del proyecto (supabase.com):

1. **Schema**: SQL Editor → pegar el contenido de `schema.sql` → Run.
2. **Auth → Providers**: confirmar que "Email" está habilitado (es el que permite login con email y contraseña).
3. **Auth → Settings**: desactivar "Allow new users to sign up". Sin esto, cualquiera podría crearse una cuenta sola.
4. **Settings → API**: copiar `Project URL` y la clave publicable, y cargarlas en el `.env` local (ver `.env.example`) y en las Environment Variables de Vercel.

## Usuarios

El login es con email y contraseña, sin mails de confirmación. Para dar acceso a alguien:

**Auth → Users → Add user → Create new user**: email + contraseña, con **Auto Confirm User** marcado.

El email no necesita ser una casilla real (no se manda ningún mail). Para cambiar una contraseña o quitar el acceso, se hace desde la misma lista de usuarios.

Sin estos pasos la app no tiene con qué conectarse — `src/lib/supabaseClient.ts` tira un error claro si faltan las env vars.
