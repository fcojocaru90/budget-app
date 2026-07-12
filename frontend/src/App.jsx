import { Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import Analytics from '@/pages/Analytics'
import Budgets from '@/pages/Budgets'
import Dashboard from '@/pages/Dashboard'
import Receipts from '@/pages/Receipts'
import Transactions from '@/pages/Transactions'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
    </Routes>
  )
}
