import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function fmt(value, currency) {
  return `${Number(value).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export default function SummaryPanel({ summary }) {
  const surplusPositive = Number(summary.surplus) >= 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {fmt(summary.income, summary.currency)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {fmt(summary.expenses, summary.currency)}
          </p>
        </CardContent>
      </Card>
      <Card className={surplusPositive ? 'border-emerald-500/40' : 'border-rose-500/40'}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Investable surplus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              surplusPositive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {fmt(summary.surplus, summary.currency)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
