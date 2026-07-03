import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportFormat = 'pdf' | 'excel';

export interface ExportScheduleRow {
    date: string;
    day: string;
    member?: string;
    location: string;
    start: string;
    end: string;
    note: string;
}

export interface ExportScheduleLabels {
    title: string;
    period: string;
    generatedOn: string;
    colDate: string;
    colDay: string;
    colMember: string;
    colLocation: string;
    colStart: string;
    colEnd: string;
    colNote: string;
}

export interface ExportScheduleContext {
    title: string;
    periodLabel: string;
    rows: ExportScheduleRow[];
    labels: ExportScheduleLabels;
}

const fileStem = (title: string, periodLabel: string) => `${title.replace(/[^\w-]+/g, '_')}-${periodLabel.replace(/[^\w-]+/g, '_')}`;

function buildPdf(doc: jsPDF, ctx: ExportScheduleContext) {
    doc.setFontSize(16);
    doc.text(ctx.title, 14, 20);
    doc.setFontSize(10);
    doc.text(`${ctx.labels.period}: ${ctx.periodLabel}`, 14, 28);
    doc.text(`${ctx.labels.generatedOn}: ${new Date().toLocaleDateString()}`, 14, 34);

    autoTable(doc, {
        startY: 40,
        head: [[
            ctx.labels.colDate,
            ctx.labels.colDay,
            ctx.labels.colMember,
            ctx.labels.colLocation,
            ctx.labels.colStart,
            ctx.labels.colEnd,
            ctx.labels.colNote,
        ]],
        body: ctx.rows.map((row) => [
            row.date,
            row.day,
            row.member ?? '—',
            row.location,
            row.start,
            row.end,
            row.note || '—',
        ]),
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 18 },
            2: { cellWidth: 34 },
            3: { cellWidth: 36 },
            4: { cellWidth: 18 },
            5: { cellWidth: 18 },
            6: { cellWidth: 44 },
        },
    });
}

async function exportExcel(ctx: ExportScheduleContext): Promise<void> {
    const XLSX = await import('xlsx');
    const aoa = [
        [ctx.title],
        [`${ctx.labels.period}: ${ctx.periodLabel}`],
        [`${ctx.labels.generatedOn}: ${new Date().toLocaleDateString()}`],
        [],
        [
            ctx.labels.colDate,
            ctx.labels.colDay,
            ctx.labels.colMember,
            ctx.labels.colLocation,
            ctx.labels.colStart,
            ctx.labels.colEnd,
            ctx.labels.colNote,
        ],
        ...ctx.rows.map((row) => [
            row.date,
            row.day,
            row.member ?? '—',
            row.location,
            row.start,
            row.end,
            row.note || '—',
        ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');
    XLSX.writeFile(wb, `${fileStem(ctx.title, ctx.periodLabel)}.xlsx`);
}

export async function exportSchedule(format: ExportFormat, ctx: ExportScheduleContext): Promise<void> {
    if (format === 'pdf') {
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        buildPdf(doc, ctx);
        doc.save(`${fileStem(ctx.title, ctx.periodLabel)}.pdf`);
        return;
    }
    await exportExcel(ctx);
}
