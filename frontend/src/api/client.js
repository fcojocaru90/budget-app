const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === 'string' ? detail : 'Request failed')
    this.status = status
    this.detail = detail
  }
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
}

export const health = () => api.get('/health')

export const listCategories = () => api.get('/api/categories')
export const createCategory = (data) => api.post('/api/categories', data)
export const updateCategory = (id, data) => api.put(`/api/categories/${id}`, data)
export const deleteCategory = (id) => api.delete(`/api/categories/${id}`)

export const listTransactions = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString()
  return api.get(`/api/transactions${query ? `?${query}` : ''}`)
}
export const createTransaction = (data) => api.post('/api/transactions', data)
export const updateTransaction = (id, data) => api.put(`/api/transactions/${id}`, data)
export const deleteTransaction = (id) => api.delete(`/api/transactions/${id}`)

export const getAnalyticsSummary = (month) =>
  api.get(`/api/analytics/summary${month ? `?month=${month}` : ''}`)
export const getCategoryBreakdown = (month) =>
  api.get(`/api/analytics/by-category${month ? `?month=${month}` : ''}`)

export const listReceipts = () => api.get('/api/receipts')
export const getReceipt = (id) => api.get(`/api/receipts/${id}`)
export const deleteReceipt = (id) => api.delete(`/api/receipts/${id}`)
export const receiptImageUrl = (id) => `${BASE_URL}/api/receipts/${id}/image`
export const addReceiptLineItem = (receiptId, data) =>
  api.post(`/api/receipts/${receiptId}/line-items`, data)
export const updateReceiptLineItem = (receiptId, lineId, data) =>
  api.put(`/api/receipts/${receiptId}/line-items/${lineId}`, data)
export const deleteReceiptLineItem = (receiptId, lineId) =>
  api.delete(`/api/receipts/${receiptId}/line-items/${lineId}`)

export async function uploadReceipt(file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE_URL}/api/receipts/upload`, { method: 'POST', body: form })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}

export const listBudgets = () => api.get('/api/budgets')
export const createBudget = (data) => api.post('/api/budgets', data)
export const updateBudget = (id, data) => api.put(`/api/budgets/${id}`, data)
export const deleteBudget = (id) => api.delete(`/api/budgets/${id}`)
export const getBudgetSummary = () => api.get('/api/budgets/summary')

export async function importTransactionsCsv(file, mapping) {
  const form = new FormData()
  form.append('file', file)
  form.append('mapping', JSON.stringify(mapping))
  const res = await fetch(`${BASE_URL}/api/transactions/import-csv`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    let detail
    try {
      detail = (await res.json()).detail
    } catch {
      detail = res.statusText
    }
    throw new ApiError(res.status, detail)
  }
  return res.json()
}
