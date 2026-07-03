import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import type { ScheduledShift } from '@shared/types';
import { formatTime, weekdayShortLabels } from '@shared/utils/date';
import { shareNative } from '@shared/utils/shareExport';

/**
 * --- SCHEDULE EXPORT ---
 * Prints the rota the way it's planned: as a month calendar per location.
 *   • PDF   — one landscape page per location: a real calendar grid with the
 *             assigned people inside each day. Made for printing.
 *   • Excel — one sheet per location with flat rows (date / member / times),
 *             made for further data work.
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

export interface ScheduleExportContext {
    /** Selected month as `YYYY-MM`. */
    monthKey: string;
    /** Human month label, e.g. "July 2026". */
    periodLabel: string;
    sections: ScheduleExportSection[];
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
// PDF — a printable month-calendar page per section (landscape A4)
// ---------------------------------------------------------------------
function buildPdf(ctx: ScheduleExportContext): jsPDF {
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
                    const lines = items.map((s) => `${formatTime(s.starts_at)}–${formatTime(s.ends_at)} ${section.label(s)}`);
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
// Excel — one sheet per section, flat rows
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
                    formatTime(s.starts_at),
                    formatTime(s.ends_at),
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
