import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BudgetForm from '@/components/BudgetForm'
import BudgetChart from '@/components/BudgetChart'
import { deleteBudget } from '@/api/client'
import { useStore } from '@/store'

export default function Budgets() {
  const {
    budgets,
    budgetSummary,
    fetchBudgets,
    fetchBudgetSummary,
    categories,
    categoriesLoaded,
    fetchCategories,
  } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function refresh() {
    await Promise.all([fetchBudgets(), fetchBudgetSummary()])
  }

  useEffect(() => {
    if (!categoriesLoaded) fetchCategories()
    refresh()
  }, [])

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))

  async function handleDelete(id) {
    if (!window.confirm('Delete this budget target?')) return
    await deleteBudget(id)
    refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus /> Add budget
        </Button>
      </div>

      {budgetSummary.items.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <BudgetChart summary={budgetSummary} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly targets</CardTitle>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No budget targets yet. Add one to track spend against a monthly limit.
            </p>
          ) : (
            <ul className="divide-y">
              {budgets.map((b) => {
                const category = categoryById[b.category_id]
                return (
                  <li key={b.id} className="flex items-center justify-between py-3">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: category?.colour ?? '#999' }}
                      />
                      {category?.name ?? 'Unknown category'}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="tabular-nums text-sm text-muted-foreground">
                        {Number(b.monthly_limit).toFixed(2)} {b.currency} / month
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => {
                            setEditing(b)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          onClick={() => handleDelete(b.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <BudgetForm
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={editing}
        onSaved={refresh}
      />
    </div>
  )
}
