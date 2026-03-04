/**
 * Document Extractor
 * Extracts text content from various document formats
 */

import * as pdfjsLib from 'pdfjs-dist';
import apiClient from '@/api/client';
import type { AxiosRequestConfig, AxiosError } from 'axios';
import { readStoredUser } from '@/utils/authStorage';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export interface DocumentContent {
  text: string;
  type: 'text' | 'pdf';
  pages?: Array<{
    pageNumber: number;
    text: string;
  }>;
}

/**
 * Extract text from a file
 */
export async function extractDocumentText(
  file: File | Blob,
  fileName?: string
): Promise<DocumentContent> {
  const fileType = file.type || getFileTypeFromName(fileName || '');
  const fileExt = fileName?.split('.').pop()?.toLowerCase() || '';
  
  console.log(`📄 Extracting text from file: ${fileName}`);
  console.log(`   Type: ${fileType}, Extension: ${fileExt}`);
  
  if (fileType === 'application/pdf' || fileExt === 'pdf') {
    console.log('   → Extracting as PDF');
    return await extractPdfText(file);
  } else if (fileExt === 'docx' || fileExt === 'doc' || 
             fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    console.log('   → Extracting as DOCX');
    return await extractDocxText(file);
  } else {
    console.log('   → Extracting as plain text');
    return await extractPlainText(file);
  }
}

/**
 * Extract text from a plain text file
 */
async function extractPlainText(file: File | Blob): Promise<DocumentContent> {
  const text = await file.text();
  console.log(`   ✅ Extracted ${text.length} characters from text file`);
  
  return {
    text,
    type: 'text'
  };
}

/**
 * Extract text from a DOCX file using mammoth.js
 * DOCX files are ZIP archives containing XML
 */
async function extractDocxText(file: File | Blob): Promise<DocumentContent> {
  try {
    console.log('   📦 Extracting text from DOCX using mammoth.js...');
    
    // Use mammoth.js for proper DOCX extraction
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    
    console.log(`   ✅ Extracted ${text.length} characters from DOCX`);
    console.log(`   📝 First 200 chars: ${text.substring(0, 200)}`);
    
    if (text.length < 10) {
      console.warn('   ⚠️ Extracted text is very short, DOCX might be empty or corrupted');
      throw new Error('Extracted text too short');
    }
    
    return {
      text: text.trim(),
      type: 'text'
    };
  } catch (error) {
    console.error('❌ Error extracting DOCX text with mammoth:', error);
    console.log('   🔄 Trying simple XML extraction fallback...');
    
    // Fallback: simple XML parsing
    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Convert to string and extract alphanumeric content
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = decoder.decode(uint8Array);
      
      // Extract readable text (remove XML tags and binary data)
      const cleanText = rawText
        .replace(/<[^>]*>/g, ' ') // Remove XML tags
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log(`   ✅ Fallback extraction: ${cleanText.length} characters`);
      
      return {
        text: cleanText,
        type: 'text'
      };
    } catch (fallbackError) {
      console.error('❌ Fallback extraction also failed:', fallbackError);
      // Last resort: try plain text
      return await extractPlainText(file);
    }
  }
}

/**
 * Extract text from a PDF file
 */
async function extractPdfText(file: File | Blob): Promise<DocumentContent> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const pages: Array<{ pageNumber: number; text: string }> = [];
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      pages.push({
        pageNumber: pageNum,
        text: pageText
      });
      
      fullText += pageText + '\n';
    }
    
    return {
      text: fullText.trim(),
      type: 'pdf',
      pages
    };
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Fetch and extract text from document by file_id
 */
export class AuthRequiredError extends Error {
  constructor(message: string = 'Authentication token missing. Please login again.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export async function fetchAndExtractDocument(
  fileId: string,
  passphrase: string,
  apiUrl?: string
): Promise<DocumentContent> {
    const user = readStoredUser() || {};
  if (!user.jwt) {
    throw new AuthRequiredError();
  }

  try {
    const requestConfig: AxiosRequestConfig & { skipAuthRedirect?: boolean } = {
      params: {
        key: passphrase,
        inline: 1,
      },
      responseType: 'blob',
      headers: {
        Accept: '*/*',
      },
      skipAuthRedirect: true,
      withCredentials: false,
    };
    
    if (apiUrl) {
      requestConfig.baseURL = apiUrl.replace(/\/$/, '');
    }

    const response = await apiClient.get<Blob>(`/files/${fileId}`, requestConfig);

    const blob = response.data;
    const contentType = response.headers['content-type'] || '';
    const contentDisposition = response.headers['content-disposition'] || '';
    
    let fileName = 'document';
    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    if (filenameMatch) {
      fileName = filenameMatch[1];
    }
    
    const file = new File([blob], fileName, { type: contentType });
    
    return await extractDocumentText(file, fileName);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError?.response?.status === 401) {
      throw new AuthRequiredError('Session expired. Please login again.');
    }

    console.error('Error fetching and extracting document:', error);
    throw error;
  }
}

/**
 * Get file type from filename
 */
function getFileTypeFromName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'doc':
    case 'docx':
      return 'application/msword';
    default:
      return 'text/plain';
  }
}

/**
 * Extract text from raw bytes (for already downloaded documents)
 */
export async function extractTextFromBytes(
  bytes: Uint8Array,
  type: 'text' | 'pdf'
): Promise<DocumentContent> {
  const blob = new Blob([bytes], { 
    type: type === 'pdf' ? 'application/pdf' : 'text/plain' 
  });
  
  if (type === 'pdf') {
    return await extractPdfText(blob);
  } else {
    return await extractPlainText(blob);
  }
}

