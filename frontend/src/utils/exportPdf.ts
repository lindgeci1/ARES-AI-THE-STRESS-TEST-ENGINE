import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}

export function exportToPdf({ title, subtitle, columns, rows, filename }: ExportPdfOptions) {
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.setTextColor(239, 68, 68);
  doc.text('ARES AI', 14, 15);

  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text(title, 14, 25);

  if (subtitle) {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, 32);
  }

  autoTable(doc, {
    startY: subtitle ? 38 : 32,
    head: [columns],
    body: rows,
    theme: 'grid',
    styles: {
      fillColor: [255, 255, 255],
      textColor: [20, 20, 20],
      fontSize: 8,
      font: 'courier',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [80, 80, 80],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Generated: ${new Date().toISOString()} - Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 10
    );
  }

  doc.save(`${filename}.pdf`);
}
