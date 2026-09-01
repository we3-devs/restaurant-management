import PDFDocument from 'pdfkit';
import type { ReportColumn } from '../report-columns';
import { reportCellToString } from './cell.util';

const ROW_HEIGHT = 18;
const MARGIN = 36;

export function toPdfBuffer(
  title: string,
  columns: ReportColumn[],
  rows: Record<string, unknown>[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      layout: 'landscape',
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - MARGIN * 2;
    const colWidth = pageWidth / columns.length;

    doc.fontSize(14).text(title, { align: 'left' });
    doc.moveDown(0.5);

    const drawHeader = () => {
      const y = doc.y;
      doc.fontSize(9).font('Helvetica-Bold');
      columns.forEach((col, i) => {
        doc.text(col.header, MARGIN + i * colWidth, y, {
          width: colWidth,
          ellipsis: true,
        });
      });
      doc.moveDown();
      doc.font('Helvetica');
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(MARGIN + pageWidth, doc.y)
        .strokeColor('#cccccc')
        .stroke();
      doc.moveDown(0.3);
    };

    drawHeader();

    for (const row of rows) {
      if (doc.y + ROW_HEIGHT > doc.page.height - MARGIN) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc.fontSize(8);
      columns.forEach((col, i) => {
        doc.text(reportCellToString(row[col.key]), MARGIN + i * colWidth, y, {
          width: colWidth,
          ellipsis: true,
        });
      });
      doc.moveDown(0.8);
    }

    doc.end();
  });
}
