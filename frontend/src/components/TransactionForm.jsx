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
import { createTransaction, updateTransaction } from '@/api/client'
import { useStore } from '@/store'

const NO_CATEGORY = 'none'

const emptyForm = {
  source: 'manual',
  amount: '',
  currency: 'RON',
  description: '',
  transaction_date: new Date().toISOString().slice(0, 10),
  category_id: NO_CATEGORY,
}

export default function TransactionForm({ open, onOpenChange, transaction, onSaved }) {
  const categories = useStore((s) => s.categories)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setError(null)
      setForm(
        transaction
          ? {
              source: transaction.source,
              amount: transaction.amount,
              currency: transaction.currency,
              description: transaction.description,
              transaction_date: transaction.transaction_date,
              category_id: transaction.category_id ?? NO_CATEGORY,
            }
          : emptyForm,
      )
    }
  }, [open, transaction])

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      ...form,
      category_id: form.category_id === NO_CATEGORY ? null : form.category_id,
    }
    try {
      if (transaction) {
        await updateTransaction(transaction.id, payload)
      } else {
        await createTransaction(payload)
      }
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(
        Array.isArray(err.detail)
          ? err.detail.map((d) => `${d.loc?.at(-1)}: ${d.msg}`).join('; ')
          : String(err.detail ?? err.message),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{transaction ? 'Edit transaction' : 'New transaction'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => set('description')(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => set('amount')(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                value={form.currency}
                maxLength={3}
                onChange={(e) => set('currency')(e.target.value.toUpperCase())}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={set('source')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="BRD">BRD</SelectItem>
                  <SelectItem value="Revolut">Revolut</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Date</Label>
              <Input
                id="transaction_date"
                type="date"
                value={form.transaction_date}
                onChange={(e) => set('transaction_date')(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category_id} onValueChange={set('category_id')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>Uncategorised</SelectItem>
                {categories.map((c) => (
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : transaction ? 'Save changes' : 'Add transaction'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
