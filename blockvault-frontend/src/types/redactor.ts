export interface RedactEntity {
    id?: string; // Client-side generated ID for tracking manual entities
    text: string;
    entity_type: string;
    page: number; // 1-indexed
    bbox: [number, number, number, number]; // [x0, y0, x1, y1]
    score?: number;
    approved?: boolean; // Client-side state to track if user wants to redact this
    group_id?: string; // Links identical repeated terms
}

export interface RedactionGroup {
    id: string; // The group_id linking entities
    term: string; // The normalized text
    count: number; // Total number of instances
    entityType: string; // Associated entity type, e.g. PERSON
}

export interface ManualRect {
    id: string;
    type: "manual";
    page: number; // 1-indexed
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SearchMatch {
    id: string;
    text: string;
    page: number;
    bbox: [number, number, number, number];
}

export interface RiskReport {
    risk_level: "Low" | "Medium" | "High" | "Critical";
    entities: Record<string, number>;
    insights: string[];
}

export interface AnalyzeResponse {
    entities: RedactEntity[];
    risk_report?: RiskReport;
}

export interface RedactRequest {
    entities: RedactEntity[];
    manual_boxes: ManualRect[];
    search_boxes: SearchMatch[];
}

export interface RedactApplyResponse {
    file_id: string;
    name: string;
    sha256: string;
    proof_type?: string;
    proof_version?: string;
    redaction_mask?: Array<{ start: number; end: number }>;
    redaction_status?: string;
    proof_location?: string;
    source_file_id?: string;
    anchor_hash?: string | null;
    anchor_tx?: string | null;
}

export interface VerifyRedactionResponse {
    file_id: string;
    proof_valid?: boolean;
    valid_proof?: boolean;
    status?: string;
    error?: string | null;
    original_hash?: string;
    redacted_hash?: string;
    original_root?: string;
    redacted_root?: string;
    proof_type?: string;
    proof_version?: string;
    anchor_hash?: string | null;
    anchor_tx?: string | null;
    chunk_count?: number;
    modified_chunks?: number[];
    progress?: {
        current: number;
        total: number;
    };
}
