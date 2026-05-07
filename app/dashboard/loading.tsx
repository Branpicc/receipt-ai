// app/dashboard/loading.tsx
//
// Shown immediately whenever a dashboard subroute is navigating in. Next.js
// streams this skeleton while the page's server-side data fetch + the
// page-component's useEffects resolve. The sidebar stays mounted (it lives
// in layout.tsx) — only this main-content skeleton replaces the previous
// page. Result: navigation feels instant even when the destination page
// has a slow initial fetch.
//
// Subroutes can override this by adding their own loading.tsx if a more
// tailored skeleton is wanted (e.g. receipts/[id] could show a receipt
// shape).

export default function DashboardLoading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="max-w-6xl mx-auto">
        {/* Heading placeholder */}
        <div className="h-8 w-64 bg-gray-200 dark:bg-dark-hover rounded mb-3" />
        <div className="h-4 w-96 bg-gray-200 dark:bg-dark-hover rounded mb-8" />

        {/* Stats row placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border p-4"
            >
              <div className="h-3 w-20 bg-gray-200 dark:bg-dark-hover rounded mb-3" />
              <div className="h-8 w-16 bg-gray-200 dark:bg-dark-hover rounded" />
            </div>
          ))}
        </div>

        {/* Content card placeholder */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border p-6 mb-6">
          <div className="h-5 w-40 bg-gray-200 dark:bg-dark-hover rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 dark:bg-dark-hover rounded" />
            <div className="h-4 w-5/6 bg-gray-200 dark:bg-dark-hover rounded" />
            <div className="h-4 w-4/6 bg-gray-200 dark:bg-dark-hover rounded" />
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-dark-hover rounded" />
          </div>
        </div>

        {/* Second content card placeholder */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-100 dark:border-dark-border p-6">
          <div className="h-5 w-32 bg-gray-200 dark:bg-dark-hover rounded mb-4" />
          <div className="space-y-3">
            <div className="h-4 w-full bg-gray-200 dark:bg-dark-hover rounded" />
            <div className="h-4 w-5/6 bg-gray-200 dark:bg-dark-hover rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
