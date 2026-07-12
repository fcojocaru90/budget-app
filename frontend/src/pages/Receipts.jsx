import { useEffect, useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ReceiptDetailDialog from '@/components/ReceiptDetailDialog'
import { deleteReceipt, receiptImageUrl, uploadReceipt } from '@/api/client'
import { useStore } from '@/store'

const ACTIVE_STATUSES = new Set(['pending', 'processing'])

const STATUS_VARIANT = {
  pending: 'secondary',
  processing: 'secondary',
  completed: 'default',
  failed: 'destructive',
}

function StatusBadge({ status }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status}</Badge>
}

export default function Receipts() {
  const { receipts, receiptsLoading, fetchReceipts, categoriesLoaded, fetchCategories } =
    useStore()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const fileInput = useRef(null)

  useEffect(() => {
    if (!categoriesLoaded) fetchCategories()
    fetchReceipts()
  }, [])

  // RCT-7b: while any receipt is pending/processing, poll until all are terminal.
  const hasActive = receipts.some((r) => ACTIVE_STATUSES.has(r.ocr_status))
  useEffect(() => {
    if (!hasActive) return
    const timer = setInterval(fetchReceipts, 2500)
    return () => clearInterval(timer)
  }, [hasActive])

  async function handleFiles(files) {
    if (!files?.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        await uploadReceipt(file)
      }
      await fetchReceipts()
    } catch (err) {
      setError(String(err.detail ?? err.message))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this receipt?')) return
    await deleteReceipt(id)
    fetchReceipts()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            multiple
            className="hidden"
            onChange={(e) => handleFiles([...e.target.files])}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Upload /> {uploading ? 'Uploading…' : 'Upload receipt'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-sm text-muted-foreground">
        Uploaded receipts are queued for OCR. Automatic text and line-item extraction
        activates once the OCR worker is running.
      </p>

      {receipts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {receiptsLoading ? 'Loading…' : 'No receipts yet. Upload one to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {receipts.map((r) => (
            <Card key={r.id} className="overflow-hidden pt-0">
              <button
                type="button"
                className="block aspect-square w-full cursor-pointer bg-muted"
                onClick={() => setDetailId(r.id)}
                aria-label="Open receipt details"
              >
                <img
                  src={receiptImageUrl(r.id)}
                  alt="Receipt"
                  className="size-full object-cover"
                />
              </button>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => setDetailId(r.id)}>
                    <StatusBadge status={r.ocr_status} />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.uploaded_at).toLocaleString()}
                </p>
                {r.line_items.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {r.line_items.length} line item{r.line_items.length === 1 ? '' : 's'}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ReceiptDetailDialog
        receiptId={detailId}
        open={detailId !== null}
        onOpenChange={(v) => !v && setDetailId(null)}
        onChanged={fetchReceipts}
      />
    </div>
  )
}
