import React from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Download, Eraser, Share2, ShieldCheck, FileKey, Trash2 } from 'lucide-react';

interface FileActionsMenuProps {
    fileId: string;
    fileName: string;
    canRedact: boolean;
    canShare: boolean;
    canDelete: boolean;
    hasProof: boolean;
    isShared: boolean;
    onDownload: () => void;
    onRedact: () => void;
    onShare: () => void;
    onVerify: () => void;
    onRevoke?: () => void;
    onDelete: () => void;
}

export const FileActionsMenu: React.FC<FileActionsMenuProps> = ({
    fileId,
    fileName,
    canRedact,
    canShare,
    canDelete,
    hasProof,
    isShared,
    onDownload,
    onRedact,
    onShare,
    onVerify,
    onRevoke,
    onDelete
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 shadow-lg border border-border">
                <DropdownMenuLabel className="truncate font-medium">{fileName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDownload(); }} className="cursor-pointer gap-2 py-2">
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                </DropdownMenuItem>

                {canRedact && !isShared && (
                    <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onRedact(); }} 
                        className="cursor-pointer gap-2 py-2 text-primary focus:text-primary focus:bg-primary/10 font-medium"
                    >
                        <Eraser className="h-4 w-4" />
                        <span>Redact Document</span>
                    </DropdownMenuItem>
                )}

                {canShare && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(); }} className="cursor-pointer gap-2 py-2">
                        <Share2 className="h-4 w-4" />
                        <span>Share Access</span>
                    </DropdownMenuItem>
                )}

                {hasProof && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onVerify(); }} className="cursor-pointer gap-2 py-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        <span>Verify ZK Proof</span>
                    </DropdownMenuItem>
                )}

                {isShared && onRevoke && canDelete && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRevoke(); }} className="cursor-pointer gap-2 py-2 text-amber-500 focus:text-amber-500 focus:bg-amber-500/10">
                        <FileKey className="h-4 w-4" />
                        <span>Revoke Access</span>
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {canDelete && (
                    <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); onDelete(); }} 
                        className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete Permanently</span>
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
