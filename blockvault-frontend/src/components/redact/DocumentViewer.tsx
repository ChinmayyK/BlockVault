import { useRef, useState, useEffect, MouseEvent } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { RedactEntity, ManualRect } from "../../types/redactor";
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure pdfjs worker locally (must match react-pdf/pdfjs-dist major version).
// We intentionally use the ESM worker file.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface DocumentViewerProps {
    file: File | string | null;
    entities: RedactEntity[];
    manualBoxes?: ManualRect[];
    onAddManualBox?: (rect: ManualRect) => void;
    onUpdateManualBox?: (id: string, updates: Partial<ManualRect>) => void;
    onToggleEntity?: (entityId: string) => void;
    activeTool?: "select" | "draw";
    previewMode?: boolean;
}

export function DocumentViewer({
    file,
    entities,
    manualBoxes = [],
    onAddManualBox,
    onUpdateManualBox,
    onToggleEntity,
    activeTool = "select",
    previewMode = false
}: DocumentViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const containerRef = useRef<HTMLDivElement>(null);

    // Manual redaction state
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);

    // PyMuPDF yields coords in "points" (1/72 inch). react-pdf renders at ~72dpi at scale=1. 
    // We apply the user's zoom parameter to the bounding box.

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (!onAddManualBox || activeTool !== "draw") return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        setStartPos({ x, y });
        setCurrentPos({ x, y });
        setIsDrawing(true);
    };

    const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
        if (!isDrawing || !startPos) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / scale;
        const y = (e.clientY - rect.top) / scale;
        setCurrentPos({ x, y });
    };

    const handleMouseUp = () => {
        if (isDrawing && startPos && currentPos && onAddManualBox && activeTool === "draw") {
            const x0 = Math.min(startPos.x, currentPos.x);
            const x1 = Math.max(startPos.x, currentPos.x);
            const y0 = Math.min(startPos.y, currentPos.y);
            const y1 = Math.max(startPos.y, currentPos.y);

            // Ensure it's not just a click
            if (x1 - x0 > 5 && y1 - y0 > 5) {
                onAddManualBox({
                    id: `manual-${Date.now()}`,
                    type: "manual",
                    page: currentPage,
                    x: x0,
                    y: y0,
                    width: x1 - x0,
                    height: y1 - y0
                });
            }
        }
        setIsDrawing(false);
        setStartPos(null);
        setCurrentPos(null);
    };

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    // Filter entities and manual boxes for the current page
    const pageEntities = entities.filter(e => e.page === currentPage);
    const pageManualBoxes = manualBoxes.filter(b => b.page === currentPage);

    if (!file) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                No document loaded
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background relative" ref={containerRef}>
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-card z-10 sticky top-0">
                <div className="flex items-center gap-2">
                    <button
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                        className="px-3 py-1 text-sm border rounded bg-background hover:bg-muted disabled:opacity-50"
                    >
                        Prev
                    </button>
                    <span className="text-sm font-medium">Page {currentPage} of {numPages}</span>
                    <button
                        disabled={currentPage >= numPages}
                        onClick={() => setCurrentPage(p => p + 1)}
                        className="px-3 py-1 text-sm border rounded bg-background hover:bg-muted disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="px-2 py-1 text-xs border rounded bg-background hover:bg-muted">-</button>
                    <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="px-2 py-1 text-xs border rounded bg-background hover:bg-muted">+</button>
                </div>
            </div>

            {/* Document View */}
            <div className="flex-1 overflow-auto bg-muted/30 p-4 flex justify-center">
                <div className="shadow-lg border bg-white relative">
                    <Document
                        file={file}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="p-10 text-center animate-pulse">Loading Document...</div>}
                        error={<div className="p-10 text-red-500 text-center">Failed to load PDF. Please ensure CORS/network settings allow loading.</div>}
                    >
                        {numPages > 0 && (
                            <div
                                className="relative select-none"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                            >
                                <Page
                                    pageNumber={currentPage}
                                    scale={scale}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={false}
                                />

                                {/* Overlay Bounding Boxes (Detected Entities) */}
                                {pageEntities.map((ent, idx) => {
                                    const [x0, y0, x1, y1] = ent.bbox;
                                    const width = x1 - x0;
                                    const height = y1 - y0;
                                    const isApproved = ent.approved !== false; // defaults to true if undefined

                                    if (!isApproved && previewMode) return null; // Hide unchecked in preview

                                    return (
                                        <div
                                            key={ent.id || idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onToggleEntity && ent.id && activeTool === "select") {
                                                    onToggleEntity(ent.id);
                                                }
                                            }}
                                            className={`absolute cursor-pointer transition-colors ${previewMode ? (isApproved ? 'bg-black border-black' : '') : (isApproved ? 'bg-black/80 border-black' : 'bg-red-500/20 border-red-500 hover:bg-red-500/40')} border`}
                                            style={{
                                                left: `${x0 * scale}px`,
                                                top: `${y0 * scale}px`,
                                                width: `${width * scale}px`,
                                                height: `${height * scale}px`,
                                            }}
                                            title={`${ent.entity_type}: ${ent.text}`}
                                        />
                                    );
                                })}

                                {/* Overlay Manual Rectangles */}
                                {pageManualBoxes.map((box) => {
                                    if (previewMode) {
                                        return (
                                            <div
                                                key={box.id}
                                                className="absolute bg-black border border-black"
                                                style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale }}
                                            />
                                        );
                                    }

                                    return (
                                        <Rnd
                                            key={box.id}
                                            size={{ width: box.width * scale, height: box.height * scale }}
                                            position={{ x: box.x * scale, y: box.y * scale }}
                                            onDragStop={(e, d) => {
                                                if (onUpdateManualBox) onUpdateManualBox(box.id, { x: d.x / scale, y: d.y / scale });
                                            }}
                                            onResizeStop={(e, direction, ref, delta, position) => {
                                                if (onUpdateManualBox) {
                                                    onUpdateManualBox(box.id, {
                                                        width: parseInt(ref.style.width, 10) / scale,
                                                        height: parseInt(ref.style.height, 10) / scale,
                                                        x: position.x / scale,
                                                        y: position.y / scale
                                                    });
                                                }
                                            }}
                                            bounds="parent"
                                            className="absolute border border-black bg-black/80 z-20 cursor-move"
                                            disableDragging={activeTool !== "select"}
                                            enableResizing={activeTool === "select"}
                                        />
                                    );
                                })}

                                {/* Drawing Box (Feedback Layer) */}
                                {isDrawing && startPos && currentPos && activeTool === "draw" && !previewMode && (
                                    <div
                                        className="absolute border-2 border-primary border-dashed bg-primary/20 pointer-events-none"
                                        style={{
                                            left: Math.min(startPos.x, currentPos.x) * scale,
                                            top: Math.min(startPos.y, currentPos.y) * scale,
                                            width: Math.abs(currentPos.x - startPos.x) * scale,
                                            height: Math.abs(currentPos.y - startPos.y) * scale,
                                        }}
                                    />
                                )}
                            </div>
                        )}
                    </Document>
                </div>
            </div>
        </div>
    );
}
