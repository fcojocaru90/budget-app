import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const FALLBACK_COLOUR = '#94A3B8' // slate — used for the Uncategorised bucket

export default function CategoryBreakdownChart({ breakdown }) {
  const total = Number(breakdown.total)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spending by category</CardTitle>
      </CardHeader>
      <CardContent>
        {breakdown.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No spending recorded this period.</p>
        ) : (
          <div className="space-y-3">
            {breakdown.items.map((item) => {
              const value = Number(item.total)
              const pct = total > 0 ? (value / total) * 100 : 0
              const colour = item.category_colour ?? FALLBACK_COLOUR
              return (
                <div key={item.category_id ?? 'uncategorised'} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: colour }}
                      />
                      {item.category_name}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {value.toFixed(2)} {breakdown.currency}
                      <span className="ml-2 text-xs">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: colour }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
