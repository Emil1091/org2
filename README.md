# Planificador de Cuadrillas (ISP)

App web para planificar tareas por **cuadrilla**: cronograma tipo Gantt con los grupos a la
izquierda y los días a la derecha, más un listado de tareas sincronizado abajo.

## Cómo correrla

```bash
npm install
npm run dev
```

Luego abrir la URL que muestra la consola (por defecto http://localhost:5173).

Para generar la versión de producción:

```bash
npm run build
npm run preview
```

## Funcionalidades

- **Cronograma**: una fila por cuadrilla, barras por tarea con inicio y fin estimado.
  - **Drag & drop**: arrastrá una barra para moverla en el tiempo, o usá los bordes para
    estirar/acortar. Mientras arrastrás se ve la fecha resultante; `Esc` cancela.
  - Zoom: **Día / Semana / Mes** (ancho de columna).
  - Rango: **Semana / 3 semanas / Mes completo**, con navegación ◀ ▶ y botón **Hoy**.
  - Fines de semana sombreados, feriados rayados y línea roja en el día de hoy.
  - Si dos tareas de una cuadrilla se solapan, se dibujan en carriles separados.
  - Clic en una barra para editar la tarea; hover muestra el detalle.
- **Listado de tareas**: tabla ordenable, con duración en días laborables y export a CSV.
- **Cuadrillas**: nombre, color y opción **"trabaja sábados"** (por defecto sí, configurable).
- **Prioridades y leyenda**: colores configurables (nombre, color y descripción de cada
  nivel). El cronograma puede colorear por prioridad o por estado (Ajustes).
- **Estados**: Pendiente, En progreso, Pausada, Bloqueada, Completada.
- **Duración laborable**: excluye domingos y feriados; sábados según la cuadrilla asignada.
- **Datos**: se guardan en el navegador (`localStorage`), con export/import JSON para
  compartir el plan.

## Estructura

```
src/
  components/   UI (TopBar, Cronograma, TaskList, modales)
  lib/          fechas/laborables, colores, export/import
  store/        estado global (Zustand + persistencia)
  types.ts      modelo de datos
```

## Próxima versión (v0.2+)

- Backend multiusuario con autenticación y permisos.
- Dependencias entre tareas (proyectar la siguiente).
- Vista móvil / PWA.
- Historial de cambios y comentarios.
