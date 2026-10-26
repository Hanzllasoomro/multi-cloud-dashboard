"use client";
import { useMemo, useState } from "react";
export interface Column<T> { key: string; header: string; numeric?: boolean; render: (row: T) => React.ReactNode; sortValue?: (row: T) => number | string; }
export default function DataTable<T>({ columns, rows, totals, emptyText = "No rows match the current filters." }: {
  columns: Column<T>[]; rows: T[]; totals?: (string | number)[]; emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a); const bv = col.sortValue!(b);
      return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
    });
  }, [rows, sort, columns]);
  if (!rows.length) return <div className="card" role="status"><p>No data yet</p><p className="muted">{emptyText} Try widening the date range or clearing a filter.</p></div>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table>
        <thead><tr>{columns.map((c) => (
          <th key={c.key} className={c.numeric ? "num" : ""} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
            {c.sortValue ? <button className="btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setSort({ key: c.key, dir: sort?.key === c.key && sort.dir === 1 ? -1 : 1 })}>{c.header} {sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}</button> : c.header}
          </th>))}</tr></thead>
        <tbody>{sorted.map((r, i) => <tr key={(r as { key?: string }).key || i}>{columns.map((c) => <td key={c.key} className={c.numeric ? "num tnum" : ""}>{c.render(r)}</td>)}</tr>)}</tbody>
        {totals && <tfoot><tr>{totals.map((t, i) => <td key={i} className={i > 0 ? "num tnum" : ""} style={{ fontWeight: 700 }}>{t}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}
