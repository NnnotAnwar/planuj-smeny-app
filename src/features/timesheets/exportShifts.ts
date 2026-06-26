import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type Shift } from '@shared/types';
import { shiftHours, fmtHours, fmtDuration, shiftGrossHours, shiftBreakHours } from '@features/shifts/shiftStats';
import { formatClock } from '@shared/utils/date';

/**
 * --- SHIFT EXPORT ---
 * Builds a member's timesheet as a PDF (jsPDF — with a signature block), an
 * Excel workbook (SheetJS / xlsx, loaded on demand) or a CSV. Mandatory-break
 * math mirrors the Overview/Timesheets tables: −30 min per started 6 h block
 * (−30 min from 6 h, −1 h from 12 h).
 */

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export interface ExportContext {
    employeeName: string;
    /** Period as `YYYY-MM`, or "All time". */
    periodLabel: string;
    /** Shifts to include (any order — sorted oldest→newest for the document). */
    shifts: Shift[];
    locationName: (id: string) => string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BREAK_LEGEND = 'Mandatory breaks deducted: -30 min from 6h, -1h from 12h (per shift).';

const round1 = (n: number) => Math.round(n * 10) / 10;

function timeOnly(iso: string): string {
    return formatClock(iso);
}

interface Row {
    date: string;
    day: string;
    location: string;
    start: string;
    end: string;
    timeRange: string;
    gross: number;
    brk: number;
    net: number;
    ongoing: boolean;
}

interface Built {
    rows: Row[];
    totals: { gross: number; brk: number; net: number; count: number };
}

/** Normalise shifts (oldest→newest) into display rows + totals. */
function build({ shifts, locationName }: ExportContext): Built {
    const ordered = [...shifts].sort(
        (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime(),
    );

    let gross = 0;
    let brk = 0;
    let net = 0;

    const rows = ordered.map((s) => {
        const d = new Date(s.started_at);
        const g = shiftGrossHours(s);
        const b = shiftBreakHours(s);
        const n = shiftHours(s);
        gross += g;
        brk += b;
        net += n;
        const start = timeOnly(s.started_at);
        const end = s.ended_at ? timeOnly(s.ended_at) : '…';
        return {
            date: `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
            day: WEEKDAYS[(d.getDay() + 6) % 7],
            location: locationName(s.location_id),
            start,
            end,
            timeRange: `${start} – ${end}`,
            gross: g,
            brk: b,
            net: n,
            ongoing: !s.ended_at,
        };
    });

    return { rows, totals: { gross, brk, net, count: rows.length } };
}

/** Safe, lowercase filename stem, e.g. "Anna Novak" + "2026-06" -> "Anna_Novak_2026-06". */
function fileStem(ctx: ExportContext): string {
    return `${ctx.employeeName}_${ctx.periodLabel}`.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'timesheet';
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------
/** Draw one employee's full timesheet (header → table → signature) on `doc`. */
function drawTimesheetPDF(doc: jsPDF, ctx: ExportContext) {
    const { rows, totals } = build(ctx);

    doc.setFontSize(20);
    doc.setTextColor(0);
    doc.text('Planuj Smeny', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Timesheet — ${ctx.employeeName}`, 14, 30);
    doc.text(`Period: ${ctx.periodLabel}`, 14, 36);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 42);

    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text(`Total Shifts: ${totals.count}`, 14, 54);
    doc.text(
        `Gross: ${fmtHours(totals.gross)}    Break: ${fmtHours(totals.brk)}    Net: ${fmtHours(totals.net)}`,
        14,
        60,
    );
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(BREAK_LEGEND, 14, 66);

    autoTable(doc, {
        startY: 72,
        head: [['Date', 'Day', 'Location', 'Time', 'Gross', 'Break', 'Net']],
        body: rows.map((r) => [
            r.date,
            r.day,
            r.location,
            r.timeRange,
            fmtDuration(r.gross),
            r.brk > 0 ? fmtDuration(r.brk) : '-',
            fmtDuration(r.net),
        ]),
        foot: [
            ['', '', '', 'Total', fmtHours(totals.gross), fmtHours(totals.brk), fmtHours(totals.net)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold' },
        styles: { fontSize: 8 },
    });

    // Signature block — this document is meant to be printed and signed.
    type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };
    const afterTable = (doc as AutoTableDoc).lastAutoTable?.finalY ?? 72;
    let y = afterTable + 24;
    if (y > 260) {
        doc.addPage();
        y = 40;
    }
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.line(14, y, 84, y);
    doc.line(120, y, 190, y);
    doc.text('Employee signature', 14, y + 5);
    doc.text('Approved by', 120, y + 5);
}

function exportPDF(ctx: ExportContext) {
    const doc = new jsPDF();
    drawTimesheetPDF(doc, ctx);
    doc.save(`${fileStem(ctx)}.pdf`);
}

// ---------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------
const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function exportCSV(ctx: ExportContext) {
    const { rows, totals } = build(ctx);
    const header = ['Date', 'Day', 'Location', 'Start', 'End', 'Gross (h)', 'Break (h)', 'Net (h)'];
    const lines: string[] = [];
    lines.push(`Timesheet — ${ctx.employeeName} — ${ctx.periodLabel}`);
    lines.push(BREAK_LEGEND);
    lines.push('');
    lines.push(header.map(csvCell).join(','));
    for (const r of rows) {
        lines.push(
            [r.date, r.day, r.location, r.start, r.end, round1(r.gross), round1(r.brk), round1(r.net)]
                .map(csvCell)
                .join(','),
        );
    }
    lines.push(
        ['Total', '', '', '', '', round1(totals.gross), round1(totals.brk), round1(totals.net)]
            .map(csvCell)
            .join(','),
    );

    // UTF-8 BOM so Excel reads accented names correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${fileStem(ctx)}.csv`);
}

// ---------------------------------------------------------------------
// EXCEL (SheetJS — loaded on demand so it only ships when actually used)
// ---------------------------------------------------------------------
async function exportExcel(ctx: ExportContext) {
    const XLSX = await import('xlsx');
    const { rows, totals } = build(ctx);

    const aoa: (string | number)[][] = [
        [`Timesheet — ${ctx.employeeName} — ${ctx.periodLabel}`],
        [BREAK_LEGEND],
        [],
        ['Date', 'Day', 'Location', 'Start', 'End', 'Gross (h)', 'Break (h)', 'Net (h)'],
        ...rows.map((r) => [
            r.date,
            r.day,
            r.location,
            r.start,
            r.end,
            round1(r.gross),
            round1(r.brk),
            round1(r.net),
        ]),
        ['Total', '', '', '', '', round1(totals.gross), round1(totals.brk), round1(totals.net)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
        { wch: 16 }, // Date
        { wch: 6 }, // Day
        { wch: 22 }, // Location
        { wch: 8 }, // Start
        { wch: 8 }, // End
        { wch: 10 }, // Gross
        { wch: 10 }, // Break
        { wch: 10 }, // Net
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheet');
    XLSX.writeFile(wb, `${fileStem(ctx)}.xlsx`);
}

export async function exportShifts(format: ExportFormat, ctx: ExportContext): Promise<void> {
    if (ctx.shifts.length === 0) return;
    if (format === 'pdf') return exportPDF(ctx);
    if (format === 'csv') return exportCSV(ctx);
    return exportExcel(ctx);
}

// ---------------------------------------------------------------------
// EXPORT ALL EMPLOYEES (one document for the whole team / month)
// ---------------------------------------------------------------------
export interface ExportAllContext {
    /** Period as `YYYY-MM`, or "All time". */
    periodLabel: string;
    locationName: (id: string) => string;
    groups: { employeeName: string; shifts: Shift[] }[];
}

function allFileStem(periodLabel: string): string {
    return `Timesheets_${periodLabel}`.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'timesheets';
}

/** PDF: each employee on their own page. */
function exportAllPDF(ctx: ExportAllContext) {
    const groups = ctx.groups.filter((g) => g.shifts.length > 0);
    const doc = new jsPDF();
    groups.forEach((g, i) => {
        if (i > 0) doc.addPage();
        drawTimesheetPDF(doc, {
            employeeName: g.employeeName,
            periodLabel: ctx.periodLabel,
            shifts: g.shifts,
            locationName: ctx.locationName,
        });
    });
    doc.save(`${allFileStem(ctx.periodLabel)}.pdf`);
}

/** CSV: one file, with a leading Employee column and a per-employee total row. */
function exportAllCSV(ctx: ExportAllContext) {
    const header = ['Employee', 'Date', 'Day', 'Location', 'Start', 'End', 'Gross (h)', 'Break (h)', 'Net (h)'];
    const lines: string[] = [];
    lines.push(`Timesheets — ${ctx.periodLabel}`);
    lines.push(BREAK_LEGEND);
    lines.push('');
    lines.push(header.map(csvCell).join(','));

    for (const g of ctx.groups) {
        const { rows, totals } = build({
            employeeName: g.employeeName,
            periodLabel: ctx.periodLabel,
            shifts: g.shifts,
            locationName: ctx.locationName,
        });
        if (rows.length === 0) continue;
        for (const r of rows) {
            lines.push(
                [g.employeeName, r.date, r.day, r.location, r.start, r.end, round1(r.gross), round1(r.brk), round1(r.net)]
                    .map(csvCell)
                    .join(','),
            );
        }
        lines.push(
            [`${g.employeeName} — Total`, '', '', '', '', '', round1(totals.gross), round1(totals.brk), round1(totals.net)]
                .map(csvCell)
                .join(','),
        );
    }

    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `${allFileStem(ctx.periodLabel)}.csv`);
}

/** Excel: one workbook, one sheet per employee. */
async function exportAllExcel(ctx: ExportAllContext) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Excel sheet names: ≤31 chars, no []:*?/\, and unique.
    const used = new Set<string>();
    const sheetName = (name: string) => {
        const base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Sheet';
        let candidate = base;
        let i = 1;
        while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 25)} ${++i}`;
        used.add(candidate.toLowerCase());
        return candidate;
    };

    let any = false;
    for (const g of ctx.groups) {
        const { rows, totals } = build({
            employeeName: g.employeeName,
            periodLabel: ctx.periodLabel,
            shifts: g.shifts,
            locationName: ctx.locationName,
        });
        if (rows.length === 0) continue;
        any = true;
        const aoa: (string | number)[][] = [
            [`Timesheet — ${g.employeeName} — ${ctx.periodLabel}`],
            [BREAK_LEGEND],
            [],
            ['Date', 'Day', 'Location', 'Start', 'End', 'Gross (h)', 'Break (h)', 'Net (h)'],
            ...rows.map((r) => [r.date, r.day, r.location, r.start, r.end, round1(r.gross), round1(r.brk), round1(r.net)]),
            ['Total', '', '', '', '', round1(totals.gross), round1(totals.brk), round1(totals.net)],
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 16 }, { wch: 6 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName(g.employeeName));
    }

    if (!any) return;
    XLSX.writeFile(wb, `${allFileStem(ctx.periodLabel)}.xlsx`);
}

export async function exportAllShifts(format: ExportFormat, ctx: ExportAllContext): Promise<void> {
    if (!ctx.groups.some((g) => g.shifts.length > 0)) return;
    if (format === 'pdf') return exportAllPDF(ctx);
    if (format === 'csv') return exportAllCSV(ctx);
    return exportAllExcel(ctx);
}
