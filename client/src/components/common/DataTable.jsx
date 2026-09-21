export function DataTable({ columns, rows, rowKey = '_id', actions }) {
  return (
    <div className="sm:overflow-x-auto">
      <table className="block w-full min-w-full text-left text-sm sm:table sm:divide-y sm:divide-slate/15">
        <thead className="hidden sm:table-header-group sm:bg-off-white">
          <tr className="sm:table-row">
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-4 py-3 font-medium text-slate sm:table-cell">
                {col.label}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-4 py-3 text-right font-medium text-slate sm:table-cell">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="flex flex-col gap-3 bg-white sm:table-row-group sm:gap-0 sm:divide-y sm:divide-slate/10">
          {rows.map((row) => (
            <tr
              key={row[rowKey]}
              className="flex flex-col gap-2 rounded-xl border border-slate/15 p-4 shadow-sm sm:table-row sm:gap-0 sm:rounded-none sm:border-0 sm:p-0 sm:shadow-none sm:hover:bg-off-white/60"
            >
              {columns.map((col) => (
                <td key={col.key} className="flex items-center justify-between gap-3 sm:table-cell sm:px-4 sm:py-3">
                  <span className="text-xs font-medium text-slate sm:hidden">{col.label}</span>
                  <span className="text-right text-navy sm:text-left">{col.render ? col.render(row) : (row[col.key] ?? '—')}</span>
                </td>
              ))}
              {actions && (
                <td className="flex justify-end gap-2 border-t border-slate/10 pt-3 sm:table-cell sm:border-0 sm:px-4 sm:py-3 sm:pt-3 sm:text-right">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
