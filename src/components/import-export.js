// HR + Operations — universal import/export engine.
// Lists → CSV / Excel (.xlsx, lazy SheetJS chunk) · Documents → Print/PDF ·
// Settings → JSON. Imports validate against a schema before anything is saved.

import { showToast } from './toast.js';
import { L } from './hr-locale.js';

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

export function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** columns: [{ key, label }] — labels become the header row (bilingual-safe). */
function toCSV(columns, rows) {
  const head = columns.map(c => csvCell(c.label)).join(',');
  const body = (rows || []).map(r => columns.map(c => csvCell(r[c.key])).join(','));
  return ['\uFEFF' + head, ...body].join('\r\n'); // BOM → Excel opens Arabic correctly
}

export function exportCSV(filename, columns, rows) {
  const base = String(filename).replace(/\.csv$/i, '');
  download(`${base}-${stamp()}.csv`, toCSV(columns, rows), 'text/csv;charset=utf-8');
  showToast(
    L(`Exported ${(rows || []).length} rows (CSV)`, `صُدّر ${(rows || []).length} صف (CSV)`),
    { variant: 'success' }
  );
}

async function exportXLSX(filename, columns, rows, sheetName = 'Sheet1') {
  const XLSX = await import('xlsx');
  const data = (rows || []).map(r => {
    const o = {};
    columns.forEach(c => {
      o[c.label] = r[c.key] ?? '';
    });
    return o;
  });
  const ws = XLSX.utils.json_to_sheet(data, { header: columns.map(c => c.label) });
  ws['!cols'] = columns.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
  showToast(
    L(`Exported ${(rows || []).length} rows (Excel)`, `صُدّر ${(rows || []).length} صف (Excel)`),
    { variant: 'success' }
  );
}

export function exportData(format, filename, columns, rows, sheetName) {
  if (format === 'xlsx') {
    return exportXLSX(filename, columns, rows, sheetName);
  }
  if (format === 'pdf') {
    showToast(L('Use Print → Save as PDF for documents', 'استخدم الطباعة ← حفظ PDF للمستندات'), {
      variant: 'info'
    });
    window.print();
    return Promise.resolve();
  }
  exportCSV(filename, columns, rows);
  return Promise.resolve();
}

export function templateCSV(filename, columns, exampleRow) {
  download(
    `${filename}-template.csv`,
    toCSV(columns, exampleRow ? [exampleRow] : []),
    'text/csv;charset=utf-8'
  );
}

export async function templateXLSX(filename, columns, exampleRow) {
  const XLSX = await import('xlsx');
  const o = {};
  columns.forEach(c => {
    o[c.label] = exampleRow ? (exampleRow[c.key] ?? '') : '';
  });
  const ws = XLSX.utils.json_to_sheet([o], {
    header: columns.map(c => c.label),
    skipHeader: false
  });
  ws['!cols'] = columns.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${filename}-template.xlsx`);
}

// — Parsing —

function parseCSVText(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let q = false;
  const pushCell = () => {
    row.push(cur);
    cur = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          q = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      q = true;
    } else if (c === ',') {
      pushCell();
    } else if (c === '\n') {
      pushCell();
      pushRow();
    } else if (c !== '\r') {
      cur += c;
    }
  }
  if (cur !== '' || row.length) {
    pushCell();
    pushRow();
  }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

/** Match file headers to schema by label (EN/AR) or key. */
function mapHeaders(headerCells, schema) {
  return headerCells.map(h => {
    const needle = String(h || '')
      .trim()
      .toLowerCase();
    const hit = schema.find(
      f =>
        needle === f.key.toLowerCase() ||
        (f.en && needle === f.en.toLowerCase()) ||
        (f.ar && needle === f.ar)
    );
    return hit ? hit.key : null;
  });
}

function parseCSVFile(file, schema) {
  return file.text().then(text => {
    const grid = parseCSVText(text);
    if (!grid.length) {
      return { rows: [], errors: [{ row: 0, field: '-', message: 'empty-file' }] };
    }
    const map = mapHeaders(grid[0], schema);
    const rows = grid.slice(1).map(cells => {
      const o = {};
      map.forEach((key, i) => {
        if (key) {
          o[key] = (cells[i] || '').trim();
        }
      });
      return o;
    });
    return { rows, errors: validateRows(rows, schema) };
  });
}

async function parseXLSXFile(file, schema) {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!grid.length) {
    return { rows: [], errors: [{ row: 0, field: '-', message: 'empty-file' }] };
  }
  const map = mapHeaders(grid[0].map(String), schema);
  const rows = grid
    .slice(1)
    .map(cells => {
      const o = {};
      map.forEach((key, i) => {
        if (key) {
          o[key] = String(cells[i] ?? '').trim();
        }
      });
      return o;
    })
    .filter(o => Object.values(o).some(v => v !== ''));
  return { rows, errors: validateRows(rows, schema) };
}

export function importFile(file, schema) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXLSXFile(file, schema);
  }
  return parseCSVFile(file, schema);
}

// schema: [{ key, en, ar, required?, type?: 'number'|'date' }]
function validateRows(rows, schema) {
  const errors = [];
  rows.forEach((r, i) => {
    const n = i + 2; // + header row
    schema.forEach(f => {
      const v = r[f.key];
      if (f.required && (v === undefined || v === '')) {
        errors.push({ row: n, field: f.key, message: 'required' });
      } else if (v !== '' && v !== undefined && f.type === 'number' && Number.isNaN(Number(v))) {
        errors.push({ row: n, field: f.key, message: 'not-a-number' });
      } else if (
        v !== '' &&
        v !== undefined &&
        f.type === 'date' &&
        !/^\d{4}-\d{2}-\d{2}$/.test(v)
      ) {
        errors.push({ row: n, field: f.key, message: 'date-must-be-YYYY-MM-DD' });
      }
    });
  });
  return errors;
}
