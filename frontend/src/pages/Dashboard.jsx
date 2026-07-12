import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import SummaryPanel from '@/components/SummaryPanel'
import CategoryBreakdownChart from '@/components/CategoryBreakdownChart'
import { getAnalyticsSummary, getCategoryBreakdown } from '@/api/client'

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth())
  const [summary, setSummary] = useState(null)
  const [breakdown, setBreakdown] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setError(null)
    Promise.all([getAnalyticsSummary(month), getCategoryBreakdown(month)])
      .then(([s, b]) => {
        if (!active) return
        setSummary(s)
        setBreakdown(b)
      })
      .catch((err) => active && setError(String(err.detail ?? err.message)))
    return () => {
      active = false
    }
  }, [month])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Label htmlFor="month" className="text-sm text-muted-foreground">
            Month
          </Label>
          <Input
            id="month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {summary && <SummaryPanel summary={summary} />}
      {breakdown && <CategoryBreakdownChart breakdown={breakdown} />}
    </div>
  )
}
