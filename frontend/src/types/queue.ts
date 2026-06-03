export interface CabinetOut {
  id: number
  code: string
  name: string
  modality: string
  is_active: boolean
}

export interface PatientOut {
  id: string
  full_name: string
  policy_number: string
  birth_date: string | null
  phone: string | null
  created_at: string
}

export interface TicketOut {
  id: number
  ticket_number: string
  status: string
  cabinet_id: number
  patient_id: string
  order_id: string | null
  study_uid: string | null
  called_at: string | null
  completed_at: string | null
  created_at: string
}

export interface TicketDetail extends TicketOut {
  patient: PatientOut
  cabinet: CabinetOut
}

export interface TicketEventOut {
  id: number
  ticket_id: number
  event_type: string
  from_status: string | null
  to_status: string | null
  created_at: string
}

export interface TicketCreateRequest {
  full_name: string
  policy_number: string
  cabinet_code: string
  phone?: string | null
  birth_date?: string | null
}

export interface NextCallRequest {
  cabinet_code: string
}
