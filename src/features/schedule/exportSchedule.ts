import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import type { ScheduledShift } from '@shared/types';
import { formatTime, weekdayShortLabels } from '@shared/utils/date';
import { shareNative } from '@shared/utils/shareExport';

/**
 * --- SCHEDULE EXPORT ---
 * Prints the rota the way it's shown on screen — the export mirrors the view:
 *   • Calendar view — one month calendar per location (PDF: landscape page,
 *     Excel: flat rows date / member / times).
 *   • Roster-grid view — the same people × days matrix as on screen: location
 *     letter (or ✓) per working day, times for timed shifts, leave codes, and
 *     the Σ column.
 * On native the file goes through the OS share sheet (browser downloads don't
 * work inside the WebView); on the web it downloads.
 */

export type ExportFormat = 'pdf' | 'excel';

export interface ScheduleExportLabels {
    title: string;
    period: string;
    generatedOn: string;
    colDate: string;
    colDay: string;
    colMember: string;
    colStart: string;
    colEnd: string;
    colNote: string;
}

export interface ScheduleExportSection {
    /** Section heading — the location name (or "No location" / a member's name). */
    name: string;
    shifts: ScheduledShift[];
    /** Chip/row label for one shift (member name in team view, location in mine). */
    label: (s: ScheduledShift) => string;
}

export interface ScheduleExportGridSection {
    /** Section heading — the location name. */
    name: string;
    /** The location's short letter — replaces the ✓ in all-day cells when set. */
    code?: string | null;
    /** Grid rows in display order (the location's roster). */
    rows: { id: string; name: string }[];
    shifts: ScheduledShift[];
    /** Approved-leave marker for a member+day (localized short code, e.g. "V"). */
    leaveFor?: (memberId: string, date: string) => string | undefined;
}

export interface ScheduleExportContext {
    /** Selected month as `YYYY-MM`. */
    monthKey: string;
    /** Human month label, e.g. "July 2026". */
    periodLabel: string;
    sections: ScheduleExportSection[];
    /** When set (roster-grid view on screen), export the people × days matrix instead. */
    gridSections?: ScheduleExportGridSection[];
    labels: ScheduleExportLabels;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Full Mon-first weeks covering the month. */
function monthWeeks(monthKey: string): Date[][] {
    const [year, month] = monthKey.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    const weeks: Date[][] = [];
    const cursor = new Date(start);
    do {
        const week: Date[] = [];
        for (let i = 0; i < 7; i++) {
            week.push(new Date(cursor));
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(week);
    } while (cursor.getMonth() === month - 1);
    return weeks;
}

function bucketByDay(shifts: ScheduledShift[]): Map<string, ScheduledShift[]> {
    const map = new Map<string, ScheduledShift[]>();
    for (const s of [...shifts].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
        const key = dayKey(new Date(s.starts_at));
        map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
}

const stem = (periodLabel: string) => `Schedule_${periodLabel}`.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '');

// --- Roster-grid (people × days) helpers ------------------------------------

function daysInMonth(monthKey: string): number {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month, 0).getDate();
}

/** Weekday index (0 = Mon) for a day of the export month. */
function dowOf(monthKey: string, day: number): number {
    const [year, month] = monthKey.split('-').map(Number);
    return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

/** Member's shifts bucketed by day-of-month, matching the on-screen grid. */
function memberDayMap(shifts: ScheduledShift[]): Map<string, ScheduledShift[]> {
    const map = new Map<string, ScheduledShift[]>();
    for (const s of [...shifts].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
        const key = `${s.user_id}|${dayKey(new Date(s.starts_at))}`;
        map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
}

/** One grid cell as plain text: letter/✓, times, or a leave code. */
function gridCellText(section: ScheduleExportGridSection, byDay: Map<string, ScheduledShift[]>, memberId: string, date: string): string {
    const items = byDay.get(`${memberId}|${date}`) ?? [];
    if (items.length > 0) {
        return items
            .map((s) => (s.all_day ? section.code || '✓' : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`))
            .join('\n');
    }
    return section.leaveFor?.(memberId, date) ?? '';
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
// PDF (grid view) — the people × days matrix per section (landscape A4)
// ---------------------------------------------------------------------
function buildGridPdf(ctx: ScheduleExportContext): jsPDF {
    const doc = new jsPDF({ orientation: 'landscape' });
    const days = daysInMonth(ctx.monthKey);
    const dayLabels = weekdayShortLabels();
    const weekend = new Set(Array.from({ length: days }, (_, i) => i + 1).filter((d) => dowOf(ctx.monthKey, d) >= 5));
    const sections = (ctx.gridSections ?? []).filter((s) => s.rows.length > 0);

    sections.forEach((section, i) => {
        if (i > 0) doc.addPage();
        const byDay = memberDayMap(section.shifts);

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(`${section.name} — ${ctx.periodLabel}`, 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`${ctx.labels.title} · ${ctx.labels.generatedOn}: ${new Date().toLocaleDateString()}`, 14, 22);

        // Two bands like the on-screen grid (1–15 / 16–end): bigger, printable
        // cells. Σ only on the second band, same as the interface.
        const bands: Array<{ from: number; to: number; sum: boolean }> = [
            { from: 1, to: Math.min(15, days), sum: false },
            { from: 16, to: days, sum: true },
        ].filter((b) => b.from <= b.to);

        let startY = 27;
        for (const band of bands) {
            const bandDays = Array.from({ length: band.to - band.from + 1 }, (_, d) => band.from + d);
            const sumCol = band.sum ? bandDays.length + 1 : -1;
            autoTable(doc, {
                startY,
                head: [[
                    ctx.labels.colMember,
                    ...bandDays.map((d) => `${d}\n${dayLabels[dowOf(ctx.monthKey, d)]}`),
                    ...(band.sum ? ['Σ'] : []),
                ]],
                body: section.rows.map((row) => [
                    row.name,
                    ...bandDays.map((d) => gridCellText(section, byDay, row.id, `${ctx.monthKey}-${pad(d)}`)),
                    ...(band.sum ? [String(section.shifts.filter((s) => s.user_id === row.id).length)] : []),
                ]),
                theme: 'grid',
                headStyles: { fillColor: [16, 185, 129], halign: 'center', fontStyle: 'bold', fontSize: 7, cellPadding: 1 },
                styles: { fontSize: 8, cellPadding: 1, halign: 'center', valign: 'middle', overflow: 'linebreak', minCellHeight: 9 },
                columnStyles: {
                    0: { cellWidth: 34, halign: 'left', fontStyle: 'bold' },
                    ...(band.sum ? { [sumCol]: { cellWidth: 10, fontStyle: 'bold' } } : {}),
                    // Constant day width across both bands so the columns line up.
                    ...Object.fromEntries(bandDays.map((_, c) => [c + 1, { cellWidth: (269 - 34 - 10) / 16 }])),
                },
                didParseCell: (data) => {
                    // Weekend tint, matching the on-screen grid.
                    const c = data.column.index;
                    if (c >= 1 && c <= bandDays.length && weekend.has(bandDays[c - 1])) {
                        if (data.section === 'body') data.cell.styles.fillColor = [254, 243, 199];
                        else data.cell.styles.fillColor = [5, 150, 105];
                    }
                },
            });
            startY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
        }
    });

    return doc;
}

// ---------------------------------------------------------------------
// PDF (calendar view) — a printable month-calendar page per section
// ---------------------------------------------------------------------
function buildPdf(ctx: ScheduleExportContext): jsPDF {
    if (ctx.gridSections) return buildGridPdf(ctx);
    const doc = new jsPDF({ orientation: 'landscape' });
    const [, month] = ctx.monthKey.split('-').map(Number);
    const weeks = monthWeeks(ctx.monthKey);
    const dayLabels = weekdayShortLabels();
    const sections = ctx.sections.filter((s) => s.shifts.length > 0);

    sections.forEach((section, i) => {
        if (i > 0) doc.addPage();
        const byDay = bucketByDay(section.shifts);

        doc.setFontSize(16);
        doc.setTextColor(0);
        doc.text(`${section.name} — ${ctx.periodLabel}`, 14, 16);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`${ctx.labels.title} · ${ctx.labels.generatedOn}: ${new Date().toLocaleDateString()}`, 14, 22);

        autoTable(doc, {
            startY: 27,
            head: [dayLabels],
            // Each calendar cell: the day number, then one line per assignment.
            body: weeks.map((week) =>
                week.map((day) => {
                    if (day.getMonth() !== month - 1) return '';
                    const items = byDay.get(dayKey(day)) ?? [];
                    const lines = items.map((s) =>
                        s.all_day ? section.label(s) : `${formatTime(s.starts_at)}–${formatTime(s.ends_at)} ${section.label(s)}`,
                    );
                    return [String(day.getDate()), ...lines].join('\n');
                }),
            ),
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], halign: 'center', fontStyle: 'bold' },
            styles: { fontSize: 7.5, cellPadding: 1.5, valign: 'top', overflow: 'linebreak', minCellHeight: 22 },
            columnStyles: Object.fromEntries(Array.from({ length: 7 }, (_, c) => [c, { cellWidth: 38.5 }])),
        });
    });

    return doc;
}

// ---------------------------------------------------------------------
// Excel — one sheet per section (matrix in grid view, flat rows otherwise)
// ---------------------------------------------------------------------
async function buildExcel(ctx: ScheduleExportContext) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const L = ctx.labels;

    // Sheet names: <=31 chars, no []:*?/\, unique.
    const used = new Set<string>();
    const sheetName = (name: string) => {
        const base = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Sheet';
        let candidate = base;
        let i = 1;
        while (used.has(candidate.toLowerCase())) candidate = `${base.slice(0, 25)} ${++i}`;
        used.add(candidate.toLowerCase());
        return candidate;
    };

    if (ctx.gridSections) {
        const days = daysInMonth(ctx.monthKey);
        let anyGrid = false;
        for (const section of ctx.gridSections) {
            if (section.rows.length === 0) continue;
            anyGrid = true;
            const byDay = memberDayMap(section.shifts);
            const aoa: (string | number)[][] = [
                [`${section.name} — ${ctx.periodLabel}`],
                [`${L.generatedOn}: ${new Date().toLocaleDateString()}`],
                [],
                [L.colMember, ...Array.from({ length: days }, (_, d) => d + 1), 'Σ'],
                ...section.rows.map((row) => [
                    row.name,
                    ...Array.from({ length: days }, (_, d) => {
                        const date = `${ctx.monthKey}-${pad(d + 1)}`;
                        // Multi-line cells read poorly in Excel — join with a space.
                        return gridCellText(section, byDay, row.id, date).replace(/\n/g, ' ');
                    }),
                    section.shifts.filter((s) => s.user_id === row.id).length,
                ]),
            ];
            const ws = XLSX.utils.aoa_to_sheet(aoa);
            ws['!cols'] = [{ wch: 24 }, ...Array.from({ length: days }, () => ({ wch: 5 })), { wch: 5 }];
            XLSX.utils.book_append_sheet(wb, ws, sheetName(section.name));
        }
        if (!anyGrid) return null;
        return { XLSX, wb };
    }

    let any = false;
    for (const section of ctx.sections) {
        if (section.shifts.length === 0) continue;
        any = true;
        const rows = [...section.shifts].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        const aoa: (string | number)[][] = [
            [`${section.name} — ${ctx.periodLabel}`],
            [`${L.generatedOn}: ${new Date().toLocaleDateString()}`],
            [],
            [L.colDate, L.colDay, L.colMember, L.colStart, L.colEnd, L.colNote],
            ...rows.map((s) => {
                const d = new Date(s.starts_at);
                return [
                    `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`,
                    weekdayShortLabels()[(d.getDay() + 6) % 7],
                    section.label(s),
                    s.all_day ? '—' : formatTime(s.starts_at),
                    s.all_day ? '—' : formatTime(s.ends_at),
                    s.note ?? '',
                ];
            }),
        ];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 12 }, { wch: 6 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(wb, ws, sheetName(section.name));
    }
    if (!any) return null;
    return { XLSX, wb };
}

export async function exportSchedule(format: ExportFormat, ctx: ScheduleExportContext): Promise<void> {
    const native = Capacitor.isNativePlatform();
    const fileStem = stem(ctx.periodLabel);
    const title = `${ctx.labels.title} — ${ctx.periodLabel}`;

    if (format === 'pdf') {
        const doc = buildPdf(ctx);
        if (native) {
            const base64 = doc.output('datauristring').split(',')[1];
            const ok = await shareNative('pdf', fileStem, title, { base64 });
            if (ok) return;
        }
        doc.save(`${fileStem}.pdf`);
        return;
    }

    const built = await buildExcel(ctx);
    if (!built) return;
    const { XLSX, wb } = built;
    if (native) {
        const buffer = XLSX.write(wb, { type: 'array' });
        const base64 = btoa(new Uint8Array(buffer as ArrayBuffer).reduce((acc, b) => acc + String.fromCharCode(b), ''));
        const ok = await shareNative('excel', fileStem, title, { base64 });
        if (ok) return;
    }
    const buffer = XLSX.write(wb, { type: 'array' });
    triggerDownload(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `${fileStem}.xlsx`,
    );
}
