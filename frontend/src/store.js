import { create } from 'zustand'
import * as client from './api/client'

// Slices: categories, transactions, budgets, receipts.
// Structured so an auth slice can be added later without reshaping consumers.
export const useStore = create((set, get) => ({
  // --- categories ---
  categories: [],
  categoriesLoaded: false,
  fetchCategories: async () => {
    const categories = await client.listCategories()
    set({ categories, categoriesLoaded: true })
  },

  // --- transactions ---
  transactions: { items: [], total: 0, page: 1, page_size: 20 },
  transactionFilters: { date_from: '', date_to: '', category_id: '' },
  transactionsLoading: false,
  setTransactionFilters: (filters) =>
    set({ transactionFilters: { ...get().transactionFilters, ...filters } }),
  fetchTransactions: async (page = 1) => {
    set({ transactionsLoading: true })
    try {
      const { date_from, date_to, category_id } = get().transactionFilters
      const transactions = await client.listTransactions({
        page,
        page_size: get().transactions.page_size,
        date_from,
        date_to,
        category_id,
      })
      set({ transactions })
    } finally {
      set({ transactionsLoading: false })
    }
  },

  // --- budgets ---
  budgets: [],
  budgetSummary: { month: '', items: [] },
  fetchBudgets: async () => {
    const budgets = await client.listBudgets()
    set({ budgets })
  },
  fetchBudgetSummary: async () => {
    const budgetSummary = await client.getBudgetSummary()
    set({ budgetSummary })
  },

  // --- receipts ---
  receipts: [],
  receiptsLoading: false,
  fetchReceipts: async () => {
    set({ receiptsLoading: true })
    try {
      const receipts = await client.listReceipts()
      set({ receipts })
    } finally {
      set({ receiptsLoading: false })
    }
  },
}))
