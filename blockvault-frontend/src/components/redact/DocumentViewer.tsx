import { useRef, useState, useEffect, MouseEvent, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { RedactEntity, ManualRect } from "../../types/redactor";

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface VirtualPageProps {
    pageNumber: number;
    scale: number;
    entities: RedactEntity[];
    manualBoxes: ManualRect[];
    onAddManualBox?: (rect: ManualRect) => void;
    onUpdateManualBox?: (id: string, updates: Partial<ManualRect>) => void;
    onToggleEntity?: (entityId: string) => void;
    activeTool: "select" | "draw";
    previewMode: boolean;
    selectedBoxId?: string | null;
    hoveredEntityId?: string | null;
    onSelectBox?: (id: string | null) => void;
    onHoverEntity?: (id: string | null) => void;
}

function VirtualPage({
    pageNumber,
    scale,
    entities,
    manualBoxes,
    onAddManualBox,
    onUpdateManualBox,
    onToggleEntity,
    activeTool,
    previewMode,
    selectedBoxId,
    hoveredEntityId,
    onSelectBox,
    onHoverEntity
}: VirtualPageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Manual redaction state localized to page
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        }, {
            rootMargin: '500px 0px', // Pre-load 500px before it comes into view
            threshold: 0
        });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (!onAddManualBox || activeTool !== "draw") {
            if (activeTool === "select" && onSelectBox) onSelectBox(null);
            return;
        }
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

            if (x1 - x0 > 5 && y1 - y0 > 5) {
                onAddManualBox({
                    id: `manual-${Date.now()}`,
                    type: "manual",
                    page: pageNumber,
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

    // We need a stable height for the container to make IntersectionObserver work correctly before the page loads.
    // 800px is a decent guess until loaded. Usually Page gives us real dimensions after load.

    return (
        <div
            ref={containerRef}
            className="relative bg-white shadow-lg mb-4 mx-auto"
            style={{ minHeight: isVisible ? 'auto' : '800px', width: 'fit-content' }}
            id={`page-${pageNumber}`}
        >
            {isVisible ? (
                <div
                    className="relative select-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                    />

                    {/* Overlay Bounding Boxes (Detected Entities) using SVG */}
                    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10, width: '100%', height: '100%' }}>
                        {entities.map((ent, idx) => {
                            const [x0, y0, x1, y1] = ent.bbox;
                            const width = x1 - x0;
                            const height = y1 - y0;
                            const isApproved = ent.approved !== false;
                            const isHovered = hoveredEntityId === ent.id;

                            if (!isApproved && previewMode) return null;

                            let fill = "transparent";
                            let stroke = "transparent";
                            let strokeWidth = 0;

                            if (previewMode) {
                                if (isApproved) {
                                    fill = "rgba(0,0,0,1)";
                                }
                            } else {
                                if (isApproved) {
                                    fill = "rgba(0,0,0,0.85)";
                                } else {
                                    fill = "rgba(239,68,68,0.2)";
                                    stroke = "rgba(239,68,68,1)";
                                    strokeWidth = 2;
                                }

                                if (isHovered) {
                                    stroke = "rgba(59,130,246,1)"; // Blue highlight
                                    strokeWidth = 3;
                                    fill = isApproved ? "rgba(0,0,0,0.9)" : "rgba(59,130,246,0.3)";
                                }
                            }

                            return (
                                <rect
                                    id={`entity-${ent.id}`}
                                    key={ent.id || idx}
                                    x={x0 * scale}
                                    y={y0 * scale}
                                    width={width * scale}
                                    height={height * scale}
                                    fill={fill}
                                    stroke={stroke}
                                    strokeWidth={strokeWidth}
                                    className="pointer-events-auto cursor-pointer transition-all duration-200"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onToggleEntity && ent.id && activeTool === "select") {
                                            onToggleEntity(ent.id);
                                        }
                                    }}
                                    onMouseEnter={() => onHoverEntity?.(ent.id!)}
                                    onMouseLeave={() => onHoverEntity?.(null)}
                                >
                                    <title>{ent.entity_type}: {ent.text}</title>
                                </rect>
                            );
                        })}
                    </svg>

                    {/* Overlay Manual Rectangles */}
                    {manualBoxes.map((box) => {
                        if (previewMode) {
                            return (
                                <div
                                    key={box.id}
                                    className="absolute bg-black border border-black pointer-events-none"
                                    style={{ left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale, zIndex: 11 }}
                                />
                            );
                        }

                        const isSelected = selectedBoxId === box.id;

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
                                className={`absolute border-2 ${isSelected ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]' : 'border-black'} bg-black/80 z-20 cursor-move transition-shadow`}
                                disableDragging={activeTool !== "select"}
                                enableResizing={activeTool === "select"}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    if (onSelectBox && activeTool === "select") onSelectBox(box.id);
                                }}
                                resizeHandleClasses={{
                                    topLeft: isSelected ? "bg-white border border-red-500 w-3 h-3 rounded-full -ml-1.5 -mt-1.5" : "",
                                    topRight: isSelected ? "bg-white border border-red-500 w-3 h-3 rounded-full -mr-1.5 -mt-1.5" : "",
                                    bottomLeft: isSelected ? "bg-white border border-red-500 w-3 h-3 rounded-full -ml-1.5 -mb-1.5" : "",
                                    bottomRight: isSelected ? "bg-white border border-red-500 w-3 h-3 rounded-full -mr-1.5 -mb-1.5" : "",
                                }}
                            />
                        );
                    })}

                    {/* Drawing Box (Feedback Layer) */}
                    {isDrawing && startPos && currentPos && activeTool === "draw" && !previewMode && (
                        <div
                            className="absolute border-2 border-primary border-dashed bg-primary/20 pointer-events-none z-30"
                            style={{
                                left: Math.min(startPos.x, currentPos.x) * scale,
                                top: Math.min(startPos.y, currentPos.y) * scale,
                                width: Math.abs(currentPos.x - startPos.x) * scale,
                                height: Math.abs(currentPos.y - startPos.y) * scale,
                            }}
                        />
                    )}
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 text-sm">
                    Rendering Page {pageNumber}
                </div>
            )}
        </div>
    );
}



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
    selectedBoxId?: string | null;
    hoveredEntityId?: string | null;
    onSelectBox?: (id: string | null) => void;
    onHoverEntity?: (id: string | null) => void;
}

export function DocumentViewer({
    file,
    entities,
    manualBoxes = [],
    onAddManualBox,
    onUpdateManualBox,
    onToggleEntity,
    activeTool = "select",
    previewMode = false,
    selectedBoxId,
    hoveredEntityId,
    onSelectBox,
    onHoverEntity
}: DocumentViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const containerRef = useRef<HTMLDivElement>(null);




    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
    }

    const pages = useMemo(() => Array.from(new Array(numPages), (el, index) => index + 1), [numPages]);

    const scrollToPage = (pageNum: number) => {
        const el = document.getElementById(`page-${pageNum}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

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
                    <span className="text-sm font-medium">{numPages} Pages</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="px-2 py-1 text-xs border rounded bg-background hover:bg-muted">-</button>
                    <span className="text-sm w-12 text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="px-2 py-1 text-xs border rounded bg-background hover:bg-muted">+</button>
                    <button
                        onClick={() => {
                            if (containerRef.current) {
                                // Fit to width roughly (subtracting sidebar width)
                                const w = containerRef.current.clientWidth;
                                setScale(Math.max(0.5, (w - 300) / 600)); // Rough estimation
                            }
                        }}
                        className="px-2 py-1 text-xs border rounded bg-background hover:bg-muted"
                    >
                        Fit
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Thumbnails Sidebar */}
                {numPages > 0 && (
                    <div className="w-32 sm:w-48 border-r bg-muted/10 overflow-y-auto flex flex-col gap-4 p-4 shrink-0">
                        <Document file={file} loading={<div className="text-xs text-center">Loading thumbs...</div>}>
                            {pages.map(page => (
                                <div
                                    key={`thumb-${page}`}
                                    className="cursor-pointer hover:ring-2 hover:ring-primary transition-all bg-white shadow-sm"
                                    onClick={() => scrollToPage(page)}
                                >
                                    <Page
                                        pageNumber={page}
                                        width={120}
                                        renderTextLayer={false}
                                        renderAnnotationLayer={false}
                                    />
                                    <div className="text-center text-xs py-1 text-muted-foreground">Page {page}</div>
                                </div>
                            ))}
                        </Document>
                    </div>
                )}

                {/* Main View */}
                <div className="flex-1 overflow-auto bg-muted/30 p-4" onClick={() => onSelectBox?.(null)}>
                    <Document
                        file={file}
                        onLoadSuccess={onDocumentLoadSuccess}
                        loading={<div className="p-10 text-center animate-pulse">Loading Document...</div>}
                        error={<div className="p-10 text-red-500 text-center">Failed to load PDF. Please ensure CORS/network settings allow loading.</div>}
                    >
                        {pages.map(pageNum => (
                            <VirtualPage
                                key={`vpage-${pageNum}`}
                                pageNumber={pageNum}
                                scale={scale}
                                entities={entities.filter(e => e.page === pageNum)}
                                manualBoxes={manualBoxes.filter(b => b.page === pageNum)}
                                onAddManualBox={onAddManualBox}
                                onUpdateManualBox={onUpdateManualBox}
                                onToggleEntity={onToggleEntity}
                                activeTool={activeTool}
                                previewMode={previewMode}
                                selectedBoxId={selectedBoxId}
                                hoveredEntityId={hoveredEntityId}
                                onSelectBox={onSelectBox}
                                onHoverEntity={onHoverEntity}
                            />
                        ))}
                    </Document>
                </div>
            </div>
        </div>
    );
}

