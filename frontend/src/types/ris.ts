export interface OrderOut {
  id: string
  patient_id: string
  modality: string
  study_uid: string
  study_description: string | null
  referring_physician: string | null
  status: string
  priority: string
  scheduled_for: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface StudyOut {
  id: number
  order_id: string
  orthanc_id: string
  series_count: number
  instance_count: number
  is_uploaded: boolean
  uploaded_at: string | null
}

export interface ProtocolOut {
  id: number
  order_id: string
  body: string
  impression: string | null
  is_draft: boolean
  signed_at: string | null
  signed_by: string | null
  created_at: string
  updated_at: string
}

export interface ModalityOut {
  code: string
  name: string
  description: string | null
}
