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

## Respaldos automáticos

1. **Database → Extensions**: activar **pg_cron**.
2. **SQL Editor**: pegar el contenido de `backups.sql` → Run.

Esto crea una tabla `backups` con dos tipos de fila:

- **`live`**: una sola fila, se pisa cada vez que se guarda algo (tarea, cuadrilla, prioridad o ajuste). Siempre tiene la última foto completa de los datos.
- **`interval`**: una fila nueva cada 30 minutos, guardando siempre las últimas 4 y borrando la más vieja.

Todo corre dentro de la base (triggers + `pg_cron`), no depende de que la app esté abierta.

Nota: en el plan gratis, un proyecto sin actividad por 7 días se pausa, y con él se pausan los respaldos programados. Entrar a la app lo reactiva.

## Restaurar un respaldo desde la app

**SQL Editor** → pegar el contenido de `admin-restore.sql` → Run (requiere `backups.sql` ya corrido).

Esto agrega un botón "Restaurar" en Ajustes → Respaldos, pero solo lo ve y lo puede usar quien esté en la tabla `admins` — el script ya te agrega a vos (`emi.l16@gmail.com`) como único administrador. La restricción es real, no solo visual: la función que restaura rechaza el pedido si quien llama no está en esa tabla, incluso llamándola a mano.

Para sumar a otro administrador, correr en el SQL Editor:
```sql
insert into admins (user_id) select id from auth.users where email = 'nuevo@email.com';
```
