// Progress bars for spend vs. target per category (BUD-5).
// Colour tiers: over budget = destructive, >=90% = amber, otherwise the category colour.
function barColour(item) {
  if (item.over_budget) return 'var(--destructive)'
  if (item.percentage >= 90) return '#F59E0B'
  return item.category_colour
}

function formatMonth(iso) {
  if (!iso) return ''
  const [year, month] = iso.split('-')
  const name = new Date(Number(year), Number(month) - 1).toLocaleString('en', {
    month: 'long',
  })
  return `${name} ${year}`
}

export default function BudgetChart({ summary }) {
  if (!summary.items.length) return null

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-muted-foreground">
        Spend vs. budget — {formatMonth(summary.month)}
      </h2>
      <div className="space-y-4">
        {summary.items.map((item) => {
          const pct = Math.min(item.percentage, 100)
          return (
            <div key={item.category_id} className="space-y-1.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: item.category_colour }}
                  />
                  {item.category_name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {Number(item.spent).toFixed(2)} / {Number(item.monthly_limit).toFixed(2)}{' '}
                  {item.currency}
                  {item.over_budget && (
                    <span className="ml-2 font-medium text-destructive">over budget</span>
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: barColour(item) }}
                />
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                {item.percentage}% used · {Number(item.remaining).toFixed(2)} {item.currency}{' '}
                {item.remaining < 0 ? 'over' : 'left'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
