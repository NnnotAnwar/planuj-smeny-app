import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { ExportContext, ExportAllContext, ExportFormat } from '@features/timesheets/exportShifts';
import { exportShifts, exportAllShifts } from '@features/timesheets/exportShifts';

/**
 * Native-friendly export + share.
 *   - Web: the export functions download the file directly (browser).
 *   - Capacitor native: a browser download doesn't work inside the WebView, so
 *     we generate the data, write it to the cache directory and open the native
 *     share sheet — for every format (PDF / CSV / Excel) and for both the
 *     single-member and all-members documents.
 */

const EXT: Record<ExportFormat, string> = { pdf: 'pdf', csv: 'csv', excel: 'xlsx' };

function sanitize(stem: string): string {
    return stem.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'export';
}

/** Write the generated file to the cache dir and open the share sheet. */
async function shareNative(
    format: ExportFormat,
    stem: string,
    title: string,
    data: { base64?: string; text?: string } | void,
): Promise<boolean> {
    if (!data || (data.base64 == null && data.text == null)) return false;
    const fileName = `${sanitize(stem)}.${EXT[format]}`;
    try {
        const res =
            data.text != null
                ? await Filesystem.writeFile({ path: fileName, data: data.text, directory: Directory.Cache, encoding: Encoding.UTF8 })
                : await Filesystem.writeFile({ path: fileName, data: data.base64!, directory: Directory.Cache });
        await Share.share({ title, url: res.uri, dialogTitle: title });
        return true;
    } catch (err) {
        console.error('Native share failed', err);
        return false;
    }
}

/** Single-member timesheet. */
export async function shareOrExport(context: ExportContext, format: ExportFormat): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        await exportShifts(format, context);
        return;
    }
    const data = await exportShifts(format, context, { returnData: true });
    const title = `${context.employeeName} — ${context.periodLabel}`;
    const ok = await shareNative(format, `${context.employeeName}_${context.periodLabel}`, title, data);
    if (!ok) await exportShifts(format, context); // last-resort download
}

/** All-members timesheet (one document for the whole team / period). */
export async function shareOrExportAll(context: ExportAllContext, format: ExportFormat): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
        await exportAllShifts(format, context);
        return;
    }
    const data = await exportAllShifts(format, context, { returnData: true });
    const title = `Timesheets — ${context.periodLabel}`;
    const ok = await shareNative(format, `Timesheets_${context.periodLabel}`, title, data);
    if (!ok) await exportAllShifts(format, context);
}
