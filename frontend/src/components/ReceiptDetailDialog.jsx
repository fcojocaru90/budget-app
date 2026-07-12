import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  addReceiptLineItem,
  deleteReceiptLineItem,
  getReceipt,
  receiptImageUrl,
  updateReceiptLineItem,
} from '@/api/client'
import { useStore } from '@/store'

const NO_CATEGORY = 'none'

function LineItemRow({ receiptId, item, categories, onChanged }) {
  const [description, setDescription] = useState(item.description)
  const [amount, setAmount] = useState(item.amount)
  const [categoryId, setCategoryId] = useState(item.category_id ?? NO_CATEGORY)
  const [saving, setSaving] = useState(false)

  const dirty =
    description !== item.description ||
    String(amount) !== String(item.amount) ||
    (categoryId === NO_CATEGORY ? null : categoryId) !== item.category_id

  async function save() {
    setSaving(true)
    try {
      await updateReceiptLineItem(receiptId, item.id, {
        description,
        amount,
        category_id: categoryId === NO_CATEGORY ? null : categoryId,
      })
      await onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    await deleteReceiptLineItem(receiptId, item.id)
    await onChanged()
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="flex-1"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        type="number"
        step="0.01"
        className="w-24"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Select value={categoryId} onValueChange={setCategoryId}>
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_CATEGORY}>Uncategorised</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={save}>
        Save
      </Button>
      <Button size="icon" variant="ghost" aria-label="Delete line" onClick={remove}>
        <Trash2 />
      </Button>
    </div>
  )
}

export default function ReceiptDetailDialog({ receiptId, open, onOpenChange, onChanged }) {
  const categories = useStore((s) => s.categories)
  const [receipt, setReceipt] = useState(null)
  const [adding, setAdding] = useState(false)

  async function reload() {
    if (!receiptId) return
    setReceipt(await getReceipt(receiptId))
  }

  useEffect(() => {
    if (open && receiptId) reload()
    else setReceipt(null)
  }, [open, receiptId])

  async function handleChanged() {
    await reload()
    onChanged?.()
  }

  async function addRow() {
    setAdding(true)
    try {
      await addReceiptLineItem(receiptId, { description: 'New item', amount: '0.00' })
      await handleChanged()
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receipt details</DialogTitle>
        </DialogHeader>
        {receipt && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant={receipt.ocr_status === 'failed' ? 'destructive' : 'default'}>
                {receipt.ocr_status}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(receipt.uploaded_at).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
              <img
                src={receiptImageUrl(receipt.id)}
                alt="Receipt"
                className="w-full rounded-md border object-contain"
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Line items</h3>
                  <Button size="sm" variant="outline" disabled={adding} onClick={addRow}>
                    <Plus /> Add
                  </Button>
                </div>
                {receipt.line_items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No line items{' '}
                    {receipt.ocr_status !== 'completed' && '(waiting for OCR)'}.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {receipt.line_items.map((item) => (
                      <LineItemRow
                        key={item.id}
                        receiptId={receipt.id}
                        item={item}
                        categories={categories}
                        onChanged={handleChanged}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {receipt.ocr_status === 'failed' && receipt.ocr_result?.error && (
              <p className="text-sm text-destructive">
                OCR failed: {receipt.ocr_result.error}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
