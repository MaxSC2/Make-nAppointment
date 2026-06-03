import type { ModalityOut, OrderOut, ProtocolOut, StudyOut } from '../types/ris'
import { risGet, risPatch, risPost, risPut } from './client'

export function getOrders(status?: string, patientId?: string) {
  const params = new URLSearchParams()
  if (status) params.set('status_filter', status)
  if (patientId) params.set('patient_id', patientId)
  const qs = params.toString()
  return risGet<OrderOut[]>(`/orders${qs ? '?' + qs : ''}`)
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
  return risPatch(`/orders/${orderId}/status`, { status })
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
