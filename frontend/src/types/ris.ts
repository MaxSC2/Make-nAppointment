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

export interface StudyListItem {
  orthanc_id: string
  study_uid: string
  study_date: string | null
  study_time: string | null
  study_description: string | null
  modality: string | null
  patient_id_dicom: string | null
  patient_name_dicom: string | null
  patient_birth_date: string | null
  accession_number: string | null
  is_stable: boolean
  unlinked: boolean
  ris_order_id: string | null
  ris_order_status: string | null
  ris_study_description: string | null
  patient: { id: string; full_name: string; birth_date: string | null } | null
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

export interface PatientStudy {
  order_id: string
  order_status: string
  study_uid: string
  modality: string | null
  created_at: string
  orthanc_id: string | null
  is_uploaded: boolean
  preview_url: string | null
  study_description?: string | null
  study_date?: string | null
  description?: string | null
  ris_order_status?: string | null
}

export interface ModalityOut {
  code: string
  name: string
  description: string | null
}
