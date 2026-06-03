import type { CabinetOut, TicketCreateRequest, TicketDetail, TicketEventOut } from '../types/queue'
import { elqueueGet, elqueuePost } from './client'

export function getCabinets() {
  return elqueueGet<CabinetOut[]>('/cabinets')
}

export function registerTicket(body: TicketCreateRequest) {
  return elqueuePost<TicketDetail>('/tickets', body)
}

export function getTickets(cabinet?: string, status?: string) {
  const params = new URLSearchParams()
  if (cabinet) params.set('cabinet', cabinet)
  if (status) params.set('status_filter', status)
  const qs = params.toString()
  return elqueueGet<TicketDetail[]>(`/tickets${qs ? '?' + qs : ''}`)
}

export function getTicket(ticketNumber: string) {
  return elqueueGet<TicketDetail>(`/tickets/${ticketNumber}`)
}

export function getTicketEvents(ticketNumber: string) {
  return elqueueGet<TicketEventOut[]>(`/tickets/${ticketNumber}/events`)
}

export function callNext(cabinetCode: string) {
  return elqueuePost<TicketDetail>('/tickets/next', { cabinet_code: cabinetCode })
}

export function completeTicket(ticketNumber: string) {
  return elqueuePost<TicketDetail>(`/tickets/${ticketNumber}/complete`)
}
