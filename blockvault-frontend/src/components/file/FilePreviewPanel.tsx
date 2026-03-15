import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, FileText, Download, Eye, ExternalLink, Loader2, File, Image as ImageIcon, Video, Music, Archive } from 'lucide-react';
import { useFiles } from '@/contexts/FileContext';

interface FilePreviewPanelProps {
  file: any;
  onClose: () => void;
}

export function FilePreviewPanel({ file, onClose }: FilePreviewPanelProps) {
  const { downloadFile } = useFiles();
  const [downloading, setDownloading] = useState(false);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <ImageIcon className="w-16 h-16 text-blue-400 opacity-80" />;
    if (['mp4', 'webm', 'mov'].includes(ext)) return <Video className="w-16 h-16 text-emerald-400 opacity-80" />;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return <Music className="w-16 h-16 text-violet-400 opacity-80" />;
    if (['zip', 'rar', 'tar', 'gz'].includes(ext)) return <Archive className="w-16 h-16 text-amber-400 opacity-80" />;
    if (['pdf'].includes(ext)) return <FileText className="w-16 h-16 text-rose-400 opacity-80" />;
    return <File className="w-16 h-16 text-slate-400 opacity-80" />;
  };

  const handleDownloadPreview = async () => {
    setDownloading(true);
    try {
      await downloadFile(file.file_id || file.id || file.share_id, file.file_name || file.name);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  if (!file) return null;

  const fileName = file.file_name || file.name || 'Unknown File';
  const isEncrypted = true; // BlockVault files are encrypted by default

  return (
    <div className="h-full flex flex-col bg-transparent overflow-hidden relative group">
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <h3 className="font-semibold text-sm truncate pr-4 text-foreground/90">{fileName}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted" onClick={onClose}>
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-zinc-950/30">
        <div className="max-w-md w-full flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-500">
          
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-slate-800/50 to-slate-900 shadow-2xl border border-slate-700/50 flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform duration-500">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {getFileIcon(fileName)}
            </div>
            {isEncrypted && (
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 border-4 border-background rounded-full flex items-center justify-center shadow-lg">
                <Lock className="w-4 h-4 text-emerald-950" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xl font-bold text-slate-200">End-to-End Encrypted</h4>
            <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
              This document is secured with military-grade encryption and cannot be previewed online. Please download to decrypt locally.
            </p>
          </div>

          <div className="pt-4 flex gap-3 w-full max-w-[240px]">
            <Button 
              className="flex-1 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all font-medium"
              onClick={handleDownloadPreview}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Decrypt & Download
                </>
              )}
            </Button>
          </div>

        </div>
      </div>
    </div>
  );
}
