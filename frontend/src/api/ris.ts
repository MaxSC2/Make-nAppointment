import type { ModalityOut, OrderOut, PatientStudy, ProtocolOut, StudyListItem, StudyOut } from '../types/ris'
import type { PatientOut } from '../types/queue'
import { risGet, risPatchBody, risPost, risPut, risV1Delete, risV1Get, risV1Post } from './client'

export interface OrderListResponse {
  items: OrderOut[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export async function getOrders(status?: string, patientId?: string) {
  const params = new URLSearchParams()
  if (status) params.set('status_filter', status)
  if (patientId) params.set('patient_id', patientId)
  const qs = params.toString()
  const data = await risGet<OrderListResponse>(`/orders${qs ? '?' + qs : ''}`)
  return data.items
}

export function getOrder(orderId: string) {
  return risGet<OrderOut>(`/orders/${orderId}`)
}

export function createOrder(body: {
  patient_id: string
  modality: string
  study_description?: string
  referring_physician?: string
  priority?: string
}) {
  return risPost<OrderOut>('/orders', body)
}

export function updateOrderStatus(orderId: string, status: string) {
  return risPatchBody<{ ok: boolean; status: string }>(`/orders/${orderId}/status`, { status })
}

export function getOrderStudies(orderId: string) {
  return risGet<StudyOut[]>(`/orders/${orderId}/studies`)
}

export function getProtocol(orderId: string) {
  return risGet<ProtocolOut>(`/orders/${orderId}/protocol`)
}

export function upsertProtocol(orderId: string, body: { body: string; impression?: string }) {
  return risPut<ProtocolOut>(`/orders/${orderId}/protocol`, body)
}

export function signProtocol(orderId: string) {
  return risPost<ProtocolOut>(`/orders/${orderId}/protocol/sign`)
}

export function getModalities() {
  return risGet<ModalityOut[]>('/modalities')
}

export function getStudies(modality?: string) {
  const qs = modality ? `?modality=${modality}` : ''
  return risGet<OrderOut[]>(`/studies${qs}`)
}

export function getStudiesList(modality?: string) {
  const qs = modality ? `?modality=${modality}` : ''
  return risV1Get<StudyListItem[]>(`/studies${qs}`)
}

export function linkStudy(orthancId: string, body: {
  modality_code: string
  study_description?: string
  referring_physician?: string
}) {
  return risV1Post<{ order_id: string; patient_id: string; patient_name: string }>(
    `/studies/${orthancId}/link`,
    body,
  )
}

// ===== Очистка PACS (1-срезные исследования) =====

export interface SingleSliceStudy {
  orthanc_id: string
  study_uid: string
  patient_name: string
  study_description: string
  study_date: string
  modality: string
  last_update: string
}

export function listSingleSliceStudies() {
  return risV1Get<{ count: number; items: SingleSliceStudy[] }>('/studies/cleanup/single-slice')
}

export function deleteOrthancStudy(orthancId: string) {
  return risV1Delete<{ orthanc_id: string; deleted_db_rows: number; status: string }>(
    `/studies/by-orthanc/${orthancId}`,
  )
}

export function getPatients(search?: string) {
  const qs = search ? `?search=${encodeURIComponent(search)}` : ''
  return risV1Get<PatientOut[]>(`/patients${qs}`)
}

export function getPatient(patientId: string) {
  return risV1Get<PatientOut>(`/patients/${patientId}`)
}

export function getPatientStudies(patientId: string) {
  return risV1Get<PatientStudy[]>(`/patients/${patientId}/studies`)
}

// ===== Мониторинг =====

export interface StatsSummary {
  now: string
  today_start: string
  orders_today: number
  orders_week: number
  completed_today: number
  completed_week: number
  in_progress: number
  scheduled: number
  tickets_waiting: number
  signed_protocols_today: number
  avg_completion_minutes_week: number
  patients_total: number
}

export interface ModalityStat {
  modality: string
  today: number
  week: number
  scheduled: number
  in_progress: number
  completed: number
  cancelled: number
}

export interface CabinetStat {
  code: string
  name: string
  modality: string
  waiting: number
  in_progress: number
  done: number
  cancelled: number
}

export interface PhysicianStat {
  user_id: string
  username: string
  full_name: string
  orders_week: number
  protocols_signed_week: number
}

export interface QueueStat {
  total: number
  waiting: number
  in_progress: number
  done: number
  cancelled: number
}

export function getStatsSummary() {
  return risV1Get<StatsSummary>('/stats/summary')
}

export function getStatsByModality() {
  return risV1Get<{ items: ModalityStat[] }>('/stats/by-modality')
}

export function getStatsByCabinet() {
  return risV1Get<{ items: CabinetStat[] }>('/stats/by-cabinet')
}

export function getStatsPhysicians() {
  return risV1Get<{ items: PhysicianStat[] }>('/stats/physicians')
}

export function getStatsQueue() {
  return risV1Get<QueueStat>('/stats/queue')
}
