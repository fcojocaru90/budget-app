import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import TransactionForm from '@/components/TransactionForm'
import CsvImportDialog from '@/components/CsvImportDialog'
import { deleteTransaction } from '@/api/client'
import { useStore } from '@/store'

const ALL_CATEGORIES = 'all'

export default function Transactions() {
  const {
    transactions,
    transactionsLoading,
    transactionFilters,
    setTransactionFilters,
    fetchTransactions,
    categories,
    categoriesLoaded,
    fetchCategories,
  } = useStore()
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (!categoriesLoaded) fetchCategories()
    fetchTransactions(1)
  }, [])

  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]))
  const { items, total, page, page_size } = transactions
  const pageCount = Math.max(1, Math.ceil(total / page_size))

  function applyFilter(filters) {
    setTransactionFilters(filters)
    fetchTransactions(1)
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this transaction?')) return
    await deleteTransaction(id)
    fetchTransactions(page)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload /> Import CSV
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            <Plus /> Add transaction
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="date_from">From</Label>
          <Input
            id="date_from"
            type="date"
            value={transactionFilters.date_from}
            onChange={(e) => applyFilter({ date_from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date_to">To</Label>
          <Input
            id="date_to"
            type="date"
            value={transactionFilters.date_to}
            onChange={(e) => applyFilter({ date_to: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label>Category</Label>
          <Select
            value={transactionFilters.category_id || ALL_CATEGORIES}
            onValueChange={(v) => applyFilter({ category_id: v === ALL_CATEGORIES ? '' : v })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {transactionsLoading ? 'Loading…' : 'No transactions yet.'}
                </TableCell>
              </TableRow>
            )}
            {items.map((t) => {
              const category = t.category_id ? categoryById[t.category_id] : null
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell className="max-w-72 truncate">{t.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t.source}</Badge>
                  </TableCell>
                  <TableCell>
                    {category ? (
                      <Badge style={{ backgroundColor: category.colour, color: '#fff' }}>
                        {category.name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(t.amount).toFixed(2)} {t.currency}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit"
                        onClick={() => {
                          setEditing(t)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} transaction{total === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => fetchTransactions(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => fetchTransactions(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editing}
        onSaved={() => fetchTransactions(page)}
      />

      <CsvImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => fetchTransactions(1)}
      />
    </div>
  )
}
