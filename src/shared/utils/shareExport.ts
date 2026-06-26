import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { ExportContext, ExportFormat } from '@features/timesheets/exportShifts';
import { exportShifts } from '@features/timesheets/exportShifts';

/**
 * Native-friendly export + share.
 * On web: falls back to the original export behavior (download).
 * On Capacitor native: for PDF writes the file and opens the native share sheet.
 */
export async function shareOrExport(
  context: ExportContext,
  format: ExportFormat
): Promise<void> {
  if (!Capacitor.isNativePlatform() || format !== 'pdf') {
    // Web or non-PDF: let the existing export logic handle download
    await exportShifts(format, context);
    return;
  }

  // Native PDF: generate data and share
  const data = await exportShifts(format, context, { returnData: true } as any);

  if (!data?.base64) {
    console.warn('No PDF data for sharing');
    await exportShifts(format, context);
    return;
  }

  const fileName = `${context.employeeName.replace(/\s+/g, '_')}_${context.periodLabel.replace(/\s+/g, '_')}.pdf`;

  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: data.base64,
      directory: Directory.Cache,
    });

    await Share.share({
      title: `Export: ${context.employeeName} - ${context.periodLabel}`,
      url: result.uri,
      dialogTitle: 'Share report',
    });
  } catch (err) {
    console.error('Native share failed, falling back', err);
    await exportShifts(format, context);
  }
}
