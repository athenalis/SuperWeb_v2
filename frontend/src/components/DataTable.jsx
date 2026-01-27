// components/DataTable.jsx
import { useState } from "react";

export default function DataTable({ columns, data, perPage = 10 }) {
  const [page, setPage] = useState(1);

  const totalPage = Math.ceil(data.length / perPage);
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const currentData = data.slice(start, end);

  return (
    <div className="bg-white rounded-xl shadow">
      {/* TABLE */}
      <div className="overflow-x-auto max-h-[500px]">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-semibold whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {currentData.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="text-center py-6 text-gray-400"
                >
                  Data kosong
                </td>
              </tr>
            )}

            {currentData.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-3">
                    {col.render
                      ? col.render(row)
                      : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PAGINATION */}
      {totalPage > 1 && (
        <div className="flex justify-between items-center px-4 py-3 border-t">
          <span className="text-sm text-gray-500">
            Halaman {page} dari {totalPage}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={page === totalPage}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
