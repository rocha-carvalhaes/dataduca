function DataTable({
  columns,
  data,
  rowKey,
  emptyMessage = 'Nenhum registro encontrado',
}) {
  return (
    <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F5F6F7] border-b border-[#D9D9D9]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 text-xs font-medium text-[#6E6E6E] uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.headerClassName || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D9D9D9]">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-[#6E6E6E]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-[#F5F6F7]">
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-6 py-4 text-sm ${
                        col.wrap ? '' : 'whitespace-nowrap'
                      } ${col.align === 'right' ? 'text-right' : ''} ${
                        col.className || 'text-[#333333]'
                      }`}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
