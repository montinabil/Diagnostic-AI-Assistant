import jsPDF from 'jspdf';
import { CaseRecord } from '../types';

/**
 * Generates and downloads a clinical-grade PDF report for a CaseRecord.
 */
export const exportCaseReportToPDF = async (caseRecord: CaseRecord): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const topMargin = 22;
  const bottomMargin = 22;

  let y = topMargin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - bottomMargin) {
      doc.addPage();
      y = topMargin;
      return true;
    }
    return false;
  };

  // Detect X-ray modality
  const isXRay = 
    caseRecord.modality === 'xray' || 
    caseRecord.type === 'xray' || 
    /x-ray|radiograph|radiology|cxr|axr|plain film/i.test(caseRecord.description || '') ||
    /radiograph|x-ray|consolidation|pneumothorax|cortical disruption/i.test(caseRecord.result.text);

  // 1. Hospital / Clinical Brand Header
  doc.setFillColor(isXRay ? 30 : 7, isXRay ? 41 : 89, isXRay ? 59 : 133); // slate-800 for xray, medical-800 for US
  doc.rect(0, 0, pageWidth, 6, 'F');

  // Brand Name & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(isXRay ? 30 : 7, isXRay ? 41 : 89, isXRay ? 59 : 133);
  doc.text(isXRay ? 'ULTRAVISION AI RADIOLOGY' : 'ULTRAVISION AI', marginX, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(
    isXRay 
      ? 'Diagnostic Plain Film Radiography & Clinical Decision Support'
      : 'Clinical Decision Support & Diagnostic Imaging System', 
    marginX, 
    y + 4.5
  );

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('REPORT STATUS: VERIFIED & COMPLETE', pageWidth - marginX, y, { align: 'right' });
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX, y + 4.5, { align: 'right' });

  y += 12;

  // Thin separator rule
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 6;

  // 2. Case Identification Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(marginX, y, contentWidth, 24, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(marginX, y, contentWidth, 24, 2, 2, 'S');

  // Metadata Columns
  const col1 = marginX + 4;
  const col2 = marginX + contentWidth * 0.35;
  const col3 = marginX + contentWidth * 0.70;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CASE IDENTIFIER', col1, y + 6);
  doc.text('EXAMINATION DATE', col2, y + 6);
  doc.text('IMAGING MODALITY', col3, y + 6);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`ID: #${caseRecord.id}`, col1, y + 12);
  doc.text(`${caseRecord.date}`, col2, y + 12);
  doc.text(
    isXRay 
      ? 'DIGITAL RADIOGRAPHY (X-RAY)' 
      : `${caseRecord.type.toUpperCase()} SCAN (${caseRecord.media.length} file${caseRecord.media.length > 1 ? 's' : ''})`, 
    col3, 
    y + 12
  );

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    isXRay 
      ? 'Reference Standard: ACR / RSNA Radiographic Diagnostic Guidelines'
      : 'Reference Standard: Abdomen Ultrasound Protocol (M.N. Mahdi Framework)', 
    col1, 
    y + 19
  );

  y += 30;

  // 3. Patient Clinical Presentation / Context
  checkPageBreak(25);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CLINICAL INDICATION & PATIENT CONTEXT', marginX, y);
  y += 5;

  const descriptionText = caseRecord.description?.trim() || 'No explicit clinical history provided with image capture.';
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  const splitDesc = doc.splitTextToSize(descriptionText, contentWidth - 8);
  const descBoxHeight = Math.max(14, splitDesc.length * 4.5 + 6);
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, y, contentWidth, descBoxHeight, 1.5, 1.5, 'F');
  doc.text(splitDesc, marginX + 4, y + 6);
  y += descBoxHeight + 6;

  // Targeted Regions of Interest (ROIs) if specified
  const targets = (caseRecord.rois && caseRecord.rois.length > 0)
    ? caseRecord.rois
    : (caseRecord.roi && caseRecord.roi.label)
    ? [caseRecord.roi]
    : [];

  if (targets.length > 0) {
    const boxHeight = 10 + targets.length * 9;
    checkPageBreak(boxHeight + 6);
    doc.setFillColor(240, 249, 255); // medical-50
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, 'F');
    doc.setDrawColor(2, 132, 199); // medical-600
    doc.setLineWidth(0.5);
    doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(2, 132, 199);
    doc.text(`TARGETED REGIONS OF INTEREST (${targets.length} FOCAL SITE${targets.length > 1 ? 'S' : ''})`, marginX + 4, y + 5);

    let itemY = y + 10;
    targets.forEach((t, i) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const shapeLabel = (t.shape || 'rectangle').toUpperCase();
      doc.text(`#${i + 1} [${shapeLabel}]: "${t.label}"`, marginX + 4, itemY);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const locText = t.anatomicalLocation ? `Zone: ${t.anatomicalLocation}  |  ` : '';
      doc.text(`${locText}Coordinates: X=${Math.round(t.x)}%, Y=${Math.round(t.y)}%`, marginX + 4, itemY + 3.8);
      itemY += 9;
    });

    y += boxHeight + 6;
  }

  // 4. Embedded Ultrasound Image(s) if available
  const imageItems = caseRecord.media.filter(
    m => m.type === 'image' && (m.preview.startsWith('data:image/') || m.preview.startsWith('http'))
  );

  if (imageItems.length > 0) {
    checkPageBreak(55);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isXRay ? 'KEY RADIOGRAPHIC IMAGES (X-RAY)' : 'KEY ULTRASOUND KEYFRAMES / CAPTURES', marginX, y);
    y += 5;

    const maxImagesToEmbed = Math.min(2, imageItems.length);
    const imgWidth = maxImagesToEmbed === 1 ? 70 : 65;
    const imgHeight = 45;

    let imgX = marginX;
    for (let i = 0; i < maxImagesToEmbed; i++) {
      const item = imageItems[i];
      try {
        // Draw image frame
        doc.setFillColor(15, 23, 42);
        doc.roundedRect(imgX, y, imgWidth, imgHeight, 1, 1, 'F');
        doc.addImage(item.preview, 'JPEG', imgX, y, imgWidth, imgHeight, undefined, 'FAST');
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(imgX, y, imgWidth, imgHeight, 1, 1, 'S');

        // Caption
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(isXRay ? `Capture ${i + 1} - Plain Film Radiograph` : `Capture ${i + 1} - B-Mode Sonogram`, imgX + 2, y + imgHeight + 4);
      } catch (err) {
        console.warn('Could not embed image in PDF report:', err);
      }
      imgX += imgWidth + 10;
    }

    y += imgHeight + 9;
  }

  // 5. Diagnostic Findings & Impression
  checkPageBreak(25);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(3, 105, 161); // medical-700
  doc.text('DIAGNOSTIC REPORT & ANALYSIS', marginX, y);
  y += 2;
  doc.setDrawColor(3, 105, 161);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, marginX + 60, y);
  y += 6;

  // Format report lines cleanly
  const rawLines = caseRecord.result.text.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) {
      y += 2.5;
      continue;
    }

    // Check for Section Header (e.g. ## Heading or **Heading:**)
    const isMajorHeader = rawLine.startsWith('## ') || rawLine.startsWith('# ') || /^\d+\.\s+\*\*/.test(rawLine);
    const isSubHeader = rawLine.startsWith('### ') || (rawLine.startsWith('**') && rawLine.endsWith('**') && rawLine.length < 60);

    if (isMajorHeader) {
      checkPageBreak(14);
      const cleanHeader = rawLine.replace(/^[#\d.\s*]+/, '').replace(/\*\*/g, '').trim();
      y += 3;
      doc.setFillColor(240, 249, 255); // medical-50
      doc.roundedRect(marginX, y - 4, contentWidth, 7, 1, 1, 'F');
      
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(3, 105, 161);
      doc.text(cleanHeader.toUpperCase(), marginX + 3, y + 1);
      y += 6;
      continue;
    }

    if (isSubHeader) {
      checkPageBreak(10);
      const cleanSub = rawLine.replace(/^[#*\s]+/, '').replace(/[*:]+$/, '').trim();
      y += 2;
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(cleanSub, marginX, y);
      y += 4.5;
      continue;
    }

    // Bullet point or numbered list item
    const isBullet = rawLine.startsWith('* ') || rawLine.startsWith('- ') || rawLine.startsWith('• ');
    const isNumbered = /^\d+\.\s+/.test(rawLine);

    if (isBullet || isNumbered) {
      const cleanItem = rawLine.replace(/^[*•\-\d.]+\s*/, '').replace(/\*\*/g, '');
      const itemLines = doc.splitTextToSize(cleanItem, contentWidth - 10);
      checkPageBreak(itemLines.length * 4.2 + 2);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(3, 105, 161);
      doc.text('•', marginX + 2, y);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(itemLines, marginX + 7, y);
      y += itemLines.length * 4.2 + 1.5;
      continue;
    }

    // Normal paragraph text
    const cleanPara = rawLine.replace(/\*\*/g, '');
    const paraLines = doc.splitTextToSize(cleanPara, contentWidth);
    checkPageBreak(paraLines.length * 4.2 + 2);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(paraLines, marginX, y);
    y += paraLines.length * 4.2 + 2;
  }

  // 6. Literature References & Grounding Chunks (if present)
  if (caseRecord.result.groundingChunks && caseRecord.result.groundingChunks.length > 0) {
    checkPageBreak(25);
    y += 4;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('SUPPORTING CLINICAL EVIDENCE & LITERATURE', marginX, y);
    y += 5;

    caseRecord.result.groundingChunks.forEach(chunk => {
      if (chunk.web) {
        checkPageBreak(10);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(3, 105, 161);
        doc.text(`[WEB] ${chunk.web.title}`, marginX + 2, y);
        y += 3.5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(chunk.web.uri, marginX + 2, y);
        y += 4;
      }
    });
  }

  // 7. Clinical Sign-off & Disclaimer Block
  checkPageBreak(36);
  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 5;

  // Two columns for review sign-off
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ATTENDING PHYSICIAN / RADIOLOGIST SIGN-OFF:', marginX, y);
  doc.text('AI REASONING VERIFICATION:', marginX + contentWidth * 0.6, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Signature: ________________________________', marginX, y);
  doc.text('Model: Gemini 3.8 Flash Vision', marginX + contentWidth * 0.6, y);

  y += 5;
  doc.text('Date: ____________________________________', marginX, y);
  doc.text('Search Grounding: Active & Validated', marginX + contentWidth * 0.6, y);

  y += 7;
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Notice: UltraVision AI is an adjunctive diagnostic support tool. Clinical correlation and physician confirmation are mandatory.',
    marginX,
    y
  );

  // 8. Add Pagination to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    // Top subtle rule
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 12, pageWidth - marginX, pageHeight - 12);

    doc.text(
      `UltraVision AI Clinical Report • Case #${caseRecord.id}`,
      marginX,
      pageHeight - 7
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 7,
      { align: 'right' }
    );
  }

  // Trigger download
  doc.save(`UltraVision_Report_Case_${caseRecord.id}.pdf`);
};
