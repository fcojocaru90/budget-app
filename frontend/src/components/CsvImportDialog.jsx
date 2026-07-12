import { useMemo, useState } from 'react'
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
import { importTransactionsCsv } from '@/api/client'

const NONE = '__none__'

// Presets match the documented BRD / Revolut export formats. Column names are
// applied only if the uploaded file actually contains them.
const PRESETS = {
  Revolut: {
    delimiter: ',',
    date_column: 'Completed Date',
    date_format: '%Y-%m-%d %H:%M:%S',
    description_column: 'Description',
    currency_column: 'Currency',
    default_currency: 'RON',
    decimal_comma: false,
    amount_columns: [
      { column: 'Amount', sign: 1, description_suffix: '' },
      { column: 'Fee', sign: -1, description_suffix: ' (fee)' },
    ],
  },
  BRD: {
    delimiter: ';',
    date_column: 'Data',
    date_format: '%d.%m.%Y',
    description_column: 'Descriere',
    currency_column: 'Valuta',
    default_currency: 'RON',
    decimal_comma: true,
    amount_columns: [
      { column: 'Debit', sign: -1, description_suffix: '' },
      { column: 'Credit', sign: 1, description_suffix: '' },
    ],
  },
}

const emptyMapping = {
  source: 'Revolut',
  delimiter: 'auto',
  date_column: '',
  date_format: '%Y-%m-%d',
  description_column: '',
  currency_column: NONE,
  default_currency: 'RON',
  decimal_comma: false,
  amount_columns: [{ column: '', sign: 1, description_suffix: '' }],
}

function detectDelimiter(line) {
  const counts = { ',': 0, ';': 0, '\t': 0 }
  for (const ch of line) if (ch in counts) counts[ch] += 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

function parseHeaders(text, delimiter) {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/)[0] ?? ''
  const delim = delimiter === 'auto' ? detectDelimiter(firstLine) : delimiter
  return firstLine
    .split(delim)
    .map((h) => h.trim())
    .filter(Boolean)
}

export default function CsvImportDialog({ open, onOpenChange, onImported }) {
  const [file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState(emptyMapping)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)

  function reset() {
    setFile(null)
    setHeaders([])
    setMapping(emptyMapping)
    setResult(null)
    setError(null)
  }

  async function handleFile(selected) {
    if (!selected) return
    setFile(selected)
    setResult(null)
    setError(null)
    const text = await selected.text()
    setMapping((m) => {
      const detected = parseHeaders(text, m.delimiter)
      setHeaders(detected)
      return m
    })
  }

  function applyPreset(source) {
    const preset = PRESETS[source]
    if (!preset) {
      setMapping((m) => ({ ...m, source }))
      return
    }
    const has = (c) => headers.includes(c)
    setMapping({
      source,
      delimiter: preset.delimiter,
      date_column: has(preset.date_column) ? preset.date_column : '',
      date_format: preset.date_format,
      description_column: has(preset.description_column) ? preset.description_column : '',
      currency_column: has(preset.currency_column) ? preset.currency_column : NONE,
      default_currency: preset.default_currency,
      decimal_comma: preset.decimal_comma,
      amount_columns: preset.amount_columns
        .filter((a) => has(a.column))
        .concat(
          preset.amount_columns.some((a) => has(a.column))
            ? []
            : [{ column: '', sign: 1, description_suffix: '' }],
        ),
    })
  }

  const set = (field) => (value) => setMapping((m) => ({ ...m, [field]: value }))

  function setAmountCol(idx, patch) {
    setMapping((m) => ({
      ...m,
      amount_columns: m.amount_columns.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }))
  }

  function addAmountCol() {
    setMapping((m) => ({
      ...m,
      amount_columns: [...m.amount_columns, { column: '', sign: 1, description_suffix: '' }],
    }))
  }

  function removeAmountCol(idx) {
    setMapping((m) => ({
      ...m,
      amount_columns: m.amount_columns.filter((_, i) => i !== idx),
    }))
  }

  const canImport = useMemo(
    () =>
      file &&
      mapping.date_column &&
      mapping.description_column &&
      mapping.amount_columns.some((a) => a.column),
    [file, mapping],
  )

  async function handleImport() {
    setImporting(true)
    setError(null)
    setResult(null)
    const payload = {
      source: mapping.source,
      date_column: mapping.date_column,
      date_format: mapping.date_format,
      description_column: mapping.description_column,
      currency_column: mapping.currency_column === NONE ? null : mapping.currency_column,
      default_currency: mapping.default_currency,
      decimal_comma: mapping.decimal_comma,
      amount_columns: mapping.amount_columns.filter((a) => a.column),
      ...(mapping.delimiter === 'auto' ? {} : { delimiter: mapping.delimiter }),
    }
    try {
      const res = await importTransactionsCsv(file, payload)
      setResult(res)
      if (res.imported > 0) onImported()
    } catch (err) {
      setError(String(err.detail ?? err.message))
    } finally {
      setImporting(false)
    }
  }

  const columnOptions = (includeNone) => (
    <SelectContent>
      {includeNone && <SelectItem value={NONE}>None</SelectItem>}
      {headers.map((h) => (
        <SelectItem key={h} value={h}>
          {h}
        </SelectItem>
      ))}
    </SelectContent>
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import transactions from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {headers.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source / preset</Label>
                  <Select value={mapping.source} onValueChange={applyPreset}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Revolut">Revolut</SelectItem>
                      <SelectItem value="BRD">BRD</SelectItem>
                      <SelectItem value="manual">Manual / other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delimiter</Label>
                  <Select value={mapping.delimiter} onValueChange={set('delimiter')}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value=",">Comma ,</SelectItem>
                      <SelectItem value=";">Semicolon ;</SelectItem>
                      <SelectItem value="\t">Tab</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date column</Label>
                  <Select value={mapping.date_column} onValueChange={set('date_column')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    {columnOptions(false)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-format">Date format</Label>
                  <Input
                    id="date-format"
                    value={mapping.date_format}
                    onChange={(e) => set('date_format')(e.target.value)}
                    placeholder="%Y-%m-%d"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description column</Label>
                <Select
                  value={mapping.description_column}
                  onValueChange={set('description_column')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  {columnOptions(false)}
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Amount columns</Label>
                <p className="text-xs text-muted-foreground">
                  Each mapped column becomes its own transaction per row (e.g. a fee, or
                  separate debit/credit columns).
                </p>
                {mapping.amount_columns.map((amountCol, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Select
                      value={amountCol.column || undefined}
                      onValueChange={(v) => setAmountCol(idx, { column: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Column" />
                      </SelectTrigger>
                      {columnOptions(false)}
                    </Select>
                    <Select
                      value={String(amountCol.sign)}
                      onValueChange={(v) => setAmountCol(idx, { sign: Number(v) })}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Keep +</SelectItem>
                        <SelectItem value="-1">Flip −</SelectItem>
                      </SelectContent>
                    </Select>
                    {mapping.amount_columns.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAmountCol(idx)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addAmountCol}>
                  Add amount column
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency column</Label>
                  <Select
                    value={mapping.currency_column}
                    onValueChange={set('currency_column')}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    {columnOptions(true)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-currency">Default currency</Label>
                  <Input
                    id="default-currency"
                    value={mapping.default_currency}
                    maxLength={3}
                    onChange={(e) => set('default_currency')(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={mapping.decimal_comma}
                  onChange={(e) => set('decimal_comma')(e.target.checked)}
                />
                Amounts use a decimal comma (e.g. 1.234,56)
              </label>
            </>
          )}

          {result && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium text-foreground">
                Imported {result.imported} transaction{result.imported === 1 ? '' : 's'}
                {result.failed > 0 && `, ${result.failed} row(s) skipped`}.
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-destructive">
                  {result.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result?.imported > 0 ? 'Close' : 'Cancel'}
          </Button>
          <Button onClick={handleImport} disabled={!canImport || importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
