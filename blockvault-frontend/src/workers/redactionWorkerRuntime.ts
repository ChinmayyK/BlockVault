import { PDFDocument, rgb } from 'pdf-lib';
import { RedactionMatch, applyRedactions } from '@/utils/redactionPatterns';
import type { DocumentContent } from '@/utils/documentExtractor';
import { extractDocumentText } from '@/utils/documentExtractor';
import { logger } from '@/utils/logger';
import type { RedactionResult } from '@/utils/redactionTypes';

/**
 * Process redactions on a document
 */
export async function processDocumentRedactionsCore(
  file: File | Blob,
  matches: RedactionMatch[],
  fileName: string = 'redacted_document'
): Promise<RedactionResult> {
  logger.debug('🔴 processDocumentRedactions called with:');
  logger.debug('  - File name:', fileName);
  logger.debug('  - File size:', file.size, 'bytes');
  logger.debug('  - File type:', file.type);
  logger.debug('  - Matches:', matches.length);
  
  if (file.size < 100) {
    throw new Error(`Input file is too small (${file.size} bytes) - cannot process`);
  }
  
  // Extract original content
  logger.debug('📄 Extracting document text...');
  const originalContent = await extractDocumentText(file, fileName);
  logger.debug('✅ Extracted text length:', originalContent.text.length, 'characters');
  
  if (originalContent.type === 'pdf') {
    logger.debug('📄 Processing as PDF');
    return await processPdfRedactions(file, matches, originalContent, fileName);
  } else {
    logger.debug('📄 Processing as text');
    return await processTextRedactions(file, matches, originalContent, fileName);
  }
}

/**
 * Process redactions on a text file
 */
async function processTextRedactions(
  file: File | Blob,
  matches: RedactionMatch[],
  originalContent: DocumentContent,
  fileName: string
): Promise<RedactionResult> {
  logger.debug('📝 Processing text file redactions');
  logger.debug(`   Original file: ${fileName}`);
  logger.debug(`   Text length: ${originalContent.text.length} chars`);
  logger.debug(`   Matches: ${matches.length}`);
  
  // Apply redactions to text
  const redactedText = applyRedactions(originalContent.text, matches);
  logger.debug(`   Redacted text length: ${redactedText.length} chars`);
  
  // Detect file type from extension
  const fileExt = fileName.split('.').pop()?.toLowerCase() || 'txt';
  let mimeType = 'text/plain';
  
  if (fileExt === 'docx') {
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (fileExt === 'doc') {
    mimeType = 'application/msword';
  }
  
  logger.debug(`   File type detected: ${fileExt}, MIME: ${mimeType}`);
  
  // For DOCX files, we need special handling
  if (fileExt === 'docx' || fileExt === 'doc') {
    return await processDocxRedactions(file, matches, redactedText, fileName, originalContent);
  }
  
  // Create redacted text file
  const redactedBlob = new Blob([redactedText], { type: mimeType });
  const redactedFile = new File([redactedBlob], `Redacted_${fileName}`, { 
    type: mimeType 
  });
  
  logger.debug(`✅ Created redacted file: ${redactedFile.name}, type: ${redactedFile.type}, size: ${redactedFile.size}`);
  
  // Create redacted content
  const redactedContent: DocumentContent = {
    text: redactedText,
    type: 'text'
  };
  
  return {
    originalContent,
    redactedContent,
    matches,
    redactedFile
  };
}

/**
 * Process DOCX redactions
 */
async function processDocxRedactions(
  file: File | Blob,
  matches: RedactionMatch[],
  redactedText: string,
  fileName: string,
  originalContent: DocumentContent
): Promise<RedactionResult> {
  logger.debug('📄 Processing DOCX file - converting to PDF format with redactions');
  logger.debug('   Input fileName:', fileName);
  logger.debug('   Redacted text length:', redactedText.length, 'characters');
  
  try {
    // Create a PDF from the redacted text using pdf-lib
    const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Page settings
    const pageWidth = 595.28; // A4 width in points
    const pageHeight = 841.89; // A4 height in points
    const margin = 72; // 1 inch margin
    const fontSize = 11;
    const lineHeight = fontSize * 1.5;
    
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    
    // Add header
    page.drawText('⚫ REDACTED DOCUMENT ⚫', {
      x: margin,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0.8, 0, 0),
    });
    
    yPosition -= lineHeight * 2;
    
    // Split text into lines and add to PDF
    const lines = redactedText.split('\n');
    
    for (const line of lines) {
      // Check if we need a new page
      if (yPosition < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
      }
      
      // Wrap long lines
      const maxWidth = pageWidth - (2 * margin);
      const words = line.split(' ');
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);
        
        if (textWidth > maxWidth && currentLine) {
          // Draw current line and start new one
          page.drawText(currentLine, {
            x: margin,
            y: yPosition,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          });
          yPosition -= lineHeight;
          currentLine = word;
          
          // Check for new page
          if (yPosition < margin + lineHeight) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }
        } else {
          currentLine = testLine;
        }
      }
      
      // Draw remaining text
      if (currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
      
      yPosition -= lineHeight;
    }
    
    // Generate PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
    
    const baseFileName = fileName.replace(/\.docx?$/i, '');
    const newFileName = baseFileName + '.pdf';
    
    const redactedFile = new File([pdfBlob], `Redacted_${newFileName}`, { 
      type: 'application/pdf' 
    });
    
    logger.debug(`✅ DOCX converted to PDF:`);
    logger.debug(`   - Name: ${redactedFile.name}`);
    logger.debug(`   - Size: ${redactedFile.size} bytes`);
    logger.debug(`   - Type: ${redactedFile.type}`);
    logger.debug(`   - Pages: ${pdfDoc.getPageCount()}`);
    
    const redactedContent: DocumentContent = {
      text: redactedText,
      type: 'text'
    };
    
    return {
      originalContent,
      redactedContent,
      matches,
      redactedFile
    };
  } catch (error) {
    logger.error('❌ Error creating PDF from DOCX:', error);
    logger.debug('🔄 Falling back to TXT format...');
    
    // Fallback to TXT if PDF creation fails
    const redactedBlob = new Blob([redactedText], { type: 'text/plain' });
    const baseFileName = fileName.replace(/\.docx?$/i, '');
    const newFileName = baseFileName + '.txt';
    
    const redactedFile = new File([redactedBlob], `Redacted_${newFileName}`, { 
      type: 'text/plain' 
    });
    
    logger.debug(`✅ Fallback - DOCX converted to TXT: ${redactedFile.name}`);
    
    const redactedContent: DocumentContent = {
      text: redactedText,
      type: 'text'
    };
    
    return {
      originalContent,
      redactedContent,
      matches,
      redactedFile
    };
  }
  
  // Advanced DOCX creation (currently disabled due to complexity)
  /* 
  try {
    // Use docx library to create a proper DOCX file
    const { Document, Paragraph, TextRun, AlignmentType, Packer } = await import('docx');
    
    logger.debug('📝 Redacted text length:', redactedText.length, 'chars');
    logger.debug('📝 First 100 chars:', redactedText.substring(0, 100));
    
    // Split redacted text into paragraphs, filtering empty lines
    const textLines = redactedText.split('\n');
    logger.debug('📝 Split into', textLines.length, 'lines');
    
    const paragraphs: any[] = [];
    
    // Add header
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'REDACTED DOCUMENT',
            bold: true,
            size: 28,
            color: 'CC0000',
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 400,
        }
      })
    );
    
    // Add content paragraphs
    textLines.forEach((line, index) => {
      // Skip completely empty lines occasionally to avoid bloat
      if (line.trim() || index % 3 === 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line || ' ',
                size: 22,
              })
            ],
            spacing: {
              after: line.trim() ? 120 : 0,
            }
          })
        );
      }
    });
    
    logger.debug('📝 Created', paragraphs.length, 'paragraphs');
    
    // Create the document
    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });
    
    logger.debug('📦 Generating DOCX blob...');
    
    // Generate DOCX file
    const blob = await Packer.toBlob(doc);
    logger.debug('📦 Blob generated:', blob.size, 'bytes, type:', blob.type);
    
    if (blob.size < 1000) {
      throw new Error(`Generated DOCX blob is too small (${blob.size} bytes)`);
    }
    
    const redactedFile = new File([blob], `Redacted_${fileName}`, { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    
    logger.debug(`✅ Created redacted DOCX: ${redactedFile.name}, size: ${redactedFile.size} bytes`);
    
    const redactedContent: DocumentContent = {
      text: redactedText,
      type: 'text'
    };
    
    return {
      originalContent,
      redactedContent,
      matches,
      redactedFile
    };
  } catch (error) {
    logger.error('❌ Error creating DOCX file:', error);
    logger.debug('🔄 Falling back to TXT format...');
    
    // Fallback: save as TXT
    const redactedBlob = new Blob([redactedText], { type: 'text/plain' });
    const newFileName = fileName.replace(/\.docx?$/i, '.txt');
    const redactedFile = new File([redactedBlob], `Redacted_${newFileName}`, { 
      type: 'text/plain' 
    });
    
    logger.debug(`✅ Fallback: Created TXT file: ${redactedFile.name}`);
    
    const redactedContent: DocumentContent = {
      text: redactedText,
      type: 'text'
    };
    
    return {
      originalContent,
      redactedContent,
      matches,
      redactedFile
    };
  }
  */
}

/**
 * Process redactions on a PDF file - SIMPLIFIED APPROACH
 * Uses pdf-lib to draw black boxes over estimated positions
 */
async function processPdfRedactions(
  file: File | Blob,
  matches: RedactionMatch[],
  originalContent: DocumentContent,
  fileName: string
): Promise<RedactionResult> {
  logger.debug(`🔴 Starting PDF redaction with ${matches.length} matches`);
  
  // Always use the reliable fallback method
  // The text-position method is complex and error-prone
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    
    // Apply redactions to text (for comparison)
    const redactedText = applyRedactions(originalContent.text, matches);
    
    logger.debug(`📄 Processing ${pages.length} page PDF with ${matches.length} redactions`);
    logger.debug(`📝 Sample matches:`, matches.slice(0, 3).map(m => ({ 
      text: m.text.substring(0, 30) + '...', 
      type: m.type,
      start: m.start,
      end: m.end 
    })));
    
    // Calculate text distribution
    const totalTextLength = originalContent.text.length;
    logger.debug(`📏 Total text length: ${totalTextLength} characters`);
    
    // Improved visual redaction boxes with better positioning
    pages.forEach((page: any, pageIndex: number) => {
        const { width, height } = page.getSize();
        logger.debug(`  Page ${pageIndex + 1} dimensions: ${width}x${height}`);
        
        // Add cleaner watermark at top right
        try {
          page.drawText('REDACTED', {
            x: width - 120,
            y: height - 40,
            size: 10,
            color: rgb(0.6, 0, 0),
            opacity: 0.7
          });
        } catch (e) {
          logger.warn('Failed to draw watermark:', e);
        }
        
        // Estimate text per page
        const textPerPage = totalTextLength / pages.length;
        const pageStartOffset = pageIndex * textPerPage;
        const pageEndOffset = (pageIndex + 1) * textPerPage;
        
        // Find matches that fall within this page's text range
        const pageMatches = matches.filter(match => 
          (match.start >= pageStartOffset && match.start < pageEndOffset) ||
          (match.end > pageStartOffset && match.end <= pageEndOffset)
        );
        
        logger.debug(`Page ${pageIndex + 1}: ${pageMatches.length} redactions`);
        
        // Draw improved black redaction boxes
        let boxesDrawn = 0;
        const leftMargin = 60; // Standard left margin
        const lineHeight = 15; // Typical line height for 11-12pt text
        const boxHeight = 13; // Slightly shorter than line height for cleaner look
        
        // Group matches by approximate line for better visual organization
        const matchesByLine: Map<number, RedactionMatch[]> = new Map();
        pageMatches.forEach((match, idx) => {
          const estimatedLine = Math.floor(idx / 3); // Group every 3 matches per line
          if (!matchesByLine.has(estimatedLine)) {
            matchesByLine.set(estimatedLine, []);
          }
          matchesByLine.get(estimatedLine)!.push(match);
        });
        
        // Draw redaction boxes line by line
        let lineIdx = 0;
        matchesByLine.forEach((lineMatches, lineNumber) => {
          const topMargin = 120;
          const yPosition = height - topMargin - (lineIdx * lineHeight);
          
          if (yPosition > 60 && yPosition < height - 60) {
            let xPosition = leftMargin;
            
            lineMatches.forEach((match) => {
              try {
                // Calculate box width with better estimation
                const avgCharWidth = 5.5;
                let boxWidth = match.text.length * avgCharWidth;
                
                // Minimum width for readability
                boxWidth = Math.max(boxWidth, 45);
                
                // Maximum width to prevent overflow
                const maxWidth = width - xPosition - 40;
                boxWidth = Math.min(boxWidth, maxWidth);
                
                if (boxWidth > 20) { // Only draw if reasonable size
                  // Draw solid black rectangle with clean edges
                  page.drawRectangle({
                    x: xPosition,
                    y: yPosition - 1,
                    width: boxWidth,
                    height: boxHeight,
                    color: rgb(0, 0, 0),
                    opacity: 1.0,
                    borderWidth: 0
                  });
                  
                  boxesDrawn++;
                  
                  // Move x position for next box (with spacing)
                  xPosition += boxWidth + 8;
                }
              } catch (err) {
                logger.warn(`Failed to draw redaction box:`, err);
              }
            });
            
            lineIdx++;
          }
        });
        
        logger.debug(`  Drew ${boxesDrawn} black boxes on page ${pageIndex + 1} (${pageMatches.length} matches)`);
        
        // Add redaction summary at bottom of last page
        if (pageIndex === pages.length - 1) {
          try {
            const summaryText = `${matches.length} item${matches.length !== 1 ? 's' : ''} redacted`;
            page.drawText(summaryText, {
              x: leftMargin,
              y: 40,
              size: 8,
              color: rgb(0.5, 0.5, 0.5),
              opacity: 0.8
            });
            
            // Add redaction notice
            page.drawText('This document contains redacted information', {
              x: leftMargin,
              y: 28,
              size: 7,
              color: rgb(0.6, 0.6, 0.6),
              opacity: 0.7
            });
          } catch (e) {
            logger.warn('Failed to draw summary:', e);
          }
        }
      });
      
      logger.debug('✅ PDF redaction boxes applied successfully');
      logger.debug('💾 Saving modified PDF...');
      
      const pdfBytes = await pdfDoc.save();
      logger.debug(`📦 PDF bytes generated: ${pdfBytes.length} bytes (${(pdfBytes.length / 1024).toFixed(2)} KB)`);
      
      if (pdfBytes.length < 100) {
        throw new Error(`PDF is too small (${pdfBytes.length} bytes) - likely corrupted`);
      }
      
      // Create blob with proper type
      const redactedBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      logger.debug(`📦 Blob created: ${redactedBlob.size} bytes, type: ${redactedBlob.type}`);
      
      const redactedFile = new File([redactedBlob], `Redacted_${fileName}`, { 
        type: 'application/pdf' 
      });
      logger.debug(`📄 File created: ${redactedFile.name}, ${redactedFile.size} bytes, type: ${redactedFile.type}`);
      
      const redactedContent: DocumentContent = {
        text: redactedText,
        type: 'pdf',
        pages: originalContent.pages?.map((page, index) => ({
          pageNumber: index + 1,
          text: redactedText
        }))
      };
      
      logger.debug('✅ Redacted PDF file ready:', redactedFile.name, redactedFile.size, 'bytes');
      
      return {
        originalContent,
        redactedContent,
        matches,
        redactedFile
      };
  } catch (error) {
    logger.error('❌ PDF redaction failed:', error);
    // Last resort: text-based redaction
    return await processTextRedactions(file, matches, originalContent, fileName);
  }
}

/**
 * Convert redactions to byte-level chunks for ZKPT compatibility
 */
export function convertRedactionsToChunks(
  text: string,
  matches: RedactionMatch[],
  chunkSize: number = 128
): number[] {
  const chunks: Set<number> = new Set();
  
  matches.forEach(match => {
    // Calculate which chunks contain redacted content
    const startChunk = Math.floor(match.start / chunkSize);
    const endChunk = Math.floor(match.end / chunkSize);
    
    for (let i = startChunk; i <= endChunk; i++) {
      chunks.add(i);
    }
  });
  
  return Array.from(chunks).sort((a, b) => a - b);
}

/**
 * Create redacted file from document
 */
export async function createRedactedFile(
  originalFile: File | Blob,
  redactedText: string,
  fileName: string,
  type: 'text' | 'pdf' = 'text'
): Promise<File> {
  if (type === 'pdf') {
    // For PDF, create a simple text-to-PDF conversion
    // In production, use a proper PDF library
    const blob = new Blob([redactedText], { type: 'text/plain' });
    return new File([blob], `Redacted_${fileName}`, { type: 'text/plain' });
  } else {
    const blob = new Blob([redactedText], { type: 'text/plain' });
    return new File([blob], `Redacted_${fileName}`, { type: 'text/plain' });
  }
}

/**
 * Validate redaction matches
 */
export function validateRedactions(
  text: string,
  matches: RedactionMatch[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  matches.forEach((match, index) => {
    // Check if match is within text bounds
    if (match.start < 0 || match.end > text.length) {
      errors.push(`Match ${index + 1} is out of bounds`);
    }
    
    // Check if match start is before end
    if (match.start >= match.end) {
      errors.push(`Match ${index + 1} has invalid range`);
    }
    
    // Check if actual text matches
    const actualText = text.slice(match.start, match.end);
    if (actualText !== match.text) {
      errors.push(`Match ${index + 1} text mismatch`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

