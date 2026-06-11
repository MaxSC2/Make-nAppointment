import type { CabinetOut, TicketCreateRequest, TicketDetail, RisRoomOut, RisTicketOut } from '../types/queue'
import { risGet, risPatchBody, risPost } from './client'

function risRoomToCabinet(r: RisRoomOut): CabinetOut {
  return {
    id: r.id,
    code: String(r.id),
    name: r.name,
    modality: r.modality,
    is_active: r.is_active,
  }
}

function risTicketToDetail(t: RisTicketOut): TicketDetail {
  return {
    id: parseInt(t.ticket_number.replace(/\D/g, ''), 10) || 0,
    ticket_number: t.ticket_number,
    status: t.status,
    cabinet_id: t.cabinet_id,
    patient_id: '',
    order_id: t.order_id ?? null,
    study_uid: t.study_uid ?? null,
    called_at: t.called_at,
    completed_at: t.completed_at,
    created_at: t.created_at,
    priority: (t.priority === 'routine' ? 'normal' : t.priority) as 'normal' | 'urgent' | 'stat' | null,
    sourceTicketId: t.id,
    service_type_name: t.service_type_name,
    patient: {
      id: '',
      full_name: t.full_name,
      policy_number: t.policy_number,
      birth_date: null,
      phone: null,
      created_at: t.created_at,
    },
    cabinet: {
      id: t.cabinet_id,
      code: String(t.cabinet_id),
      name: t.cabinet_name || '',
      modality: t.modality,
      is_active: true,
    },
  }
}

export function getCabinets() {
  return risGet<RisRoomOut[]>('/queue/cabinets').then(rooms => rooms.map(risRoomToCabinet))
}

export function registerTicket(body: TicketCreateRequest) {
  const mappedPriority = body.priority === 'normal' ? 'routine' : body.priority || 'routine'
  return risPost<RisTicketOut>('/queue/tickets', {
    full_name: body.full_name,
    policy_number: body.policy_number,
    modality: body.cabinet_code,
    priority: mappedPriority,
  }).then(risTicketToDetail)
}

export function getTickets(cabinet?: string, status?: string) {
  const params = new URLSearchParams()
  if (cabinet) params.set('cabinet_id', cabinet)
  if (status) params.set('status', status)
  const qs = params.toString()
  return risGet<RisTicketOut[]>(`/queue/tickets${qs ? '?' + qs : ''}`).then(list => list.map(risTicketToDetail))
}

export function callTicket(ticketId: string) {
  return risPost<{ ticket_id: string; ticket_number: string; status: string; order_id: string | null; called_at: string | null }>(
    `/queue/tickets/${ticketId}/call`,
  )
}

export function completeTicket(ticketId: string) {
  return risPost<RisTicketOut>(`/queue/tickets/${ticketId}/complete`).then(risTicketToDetail)
}

export function updateTicketPatient(ticketId: string, fullName: string, policyNumber: string) {
  return risPatchBody<RisTicketOut>(`/queue/tickets/${ticketId}/patient`, {
    full_name: fullName,
    policy_number: policyNumber,
  }).then(risTicketToDetail)
}
