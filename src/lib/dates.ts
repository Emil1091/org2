import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { es } from 'date-fns/locale'

/** Fecha de hoy como 'YYYY-MM-DD' (hora local). */
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/** Convierte 'YYYY-MM-DD' a Date local. */
export function parseDay(iso: string): Date {
  return parseISO(iso)
}

export function formatDay(iso: string, fmt = 'dd/MM/yyyy'): string {
  return format(parseDay(iso), fmt, { locale: es })
}

export function addDaysISO(iso: string, days: number): string {
  return format(addDays(parseDay(iso), days), 'yyyy-MM-dd')
}

/** Diferencia en días de calendario (b - a). */
export function diffDays(aISO: string, bISO: string): number {
  return differenceInCalendarDays(parseDay(bISO), parseDay(aISO))
}

/** 0 = domingo ... 6 = sábado */
export function weekday(iso: string): number {
  return getDay(parseDay(iso))
}

export function isSunday(iso: string): boolean {
  return weekday(iso) === 0
}

export function isSaturday(iso: string): boolean {
  return weekday(iso) === 6
}

/** Lunes de la semana de la fecha dada. */
export function weekStartISO(iso: string): string {
  return format(startOfWeek(parseDay(iso), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** Primer día del mes. */
export function monthStartISO(iso: string): string {
  return format(startOfMonth(parseDay(iso)), 'yyyy-MM-dd')
}

/** Días en el mes (para el preset "mes completo"). */
export function daysInMonthISO(iso: string): number {
  const d = parseDay(iso)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

/** Primer día del mes resultante de sumar `months` meses. */
export function addMonthsISO(iso: string, months: number): string {
  const d = parseDay(iso)
  return format(new Date(d.getFullYear(), d.getMonth() + months, 1), 'yyyy-MM-dd')
}

/** Lista de días ISO entre dos fechas, inclusive. */
export function eachDayISO(startISO: string, endISO: string): string[] {
  const from = parseDay(startISO)
  const to = parseDay(endISO)
  if (to < from) return []
  return eachDayOfInterval({ start: from, end: to }).map((d) =>
    format(d, 'yyyy-MM-dd'),
  )
}

/**
 * Cantidad de días laborables entre start y end (inclusive).
 * - Domingos siempre se excluyen.
 * - Sábados se cuentan solo si `worksSaturday`.
 * - Feriados siempre se excluyen.
 */
export function workdayCount(
  startISO: string,
  endISO: string,
  worksSaturday: boolean,
  holidays: Set<string>,
): number {
  return eachDayISO(startISO, endISO).filter((d) => {
    if (holidays.has(d)) return false
    if (isSunday(d)) return false
    if (isSaturday(d) && !worksSaturday) return false
    return true
  }).length
}

export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]
