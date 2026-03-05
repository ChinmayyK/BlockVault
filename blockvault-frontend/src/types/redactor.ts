export interface RedactEntity {
    id?: string; // Client-side generated ID for tracking manual entities
    text: string;
    entity_type: string;
    page: number; // 1-indexed
    bbox: [number, number, number, number]; // [x0, y0, x1, y1]
    score?: number;
    approved?: boolean; // Client-side state to track if user wants to redact this
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

export interface AnalyzeResponse {
    entities: RedactEntity[];
}

export interface RedactRequest {
    entities: RedactEntity[];
    manual_boxes: ManualRect[];
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
}
