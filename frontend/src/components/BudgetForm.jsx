import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createBudget, updateBudget } from '@/api/client'
import { useStore } from '@/store'

export default function BudgetForm({ open, onOpenChange, budget, onSaved }) {
  const categories = useStore((s) => s.categories)
  const budgets = useStore((s) => s.budgets)
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')
  const [currency, setCurrency] = useState('RON')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const isEdit = Boolean(budget)

  useEffect(() => {
    if (open) {
      setError(null)
      setCategoryId(budget?.category_id ?? '')
      setLimit(budget?.monthly_limit ?? '')
      setCurrency(budget?.currency ?? 'RON')
    }
  }, [open, budget])

  // On create, only offer categories that don't already have a target.
  const budgetedIds = new Set(budgets.map((b) => b.category_id))
  const available = isEdit
    ? categories
    : categories.filter((c) => !budgetedIds.has(c.id))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateBudget(budget.id, { monthly_limit: limit, currency })
      } else {
        await createBudget({ category_id: categoryId, monthly_limit: limit, currency })
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(String(err.detail ?? err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit budget target' : 'New budget target'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={isEdit}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: c.colour }}
                    />
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Monthly limit</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                min="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-currency">Currency</Label>
              <Input
                id="budget-currency"
                value={currency}
                maxLength={3}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (!isEdit && !categoryId)}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add budget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
