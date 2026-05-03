export interface RedactionRegion {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RedactionPayload {
  file_id: string;
  passphrase: string;
  patterns_applied: string[];
  custom_terms: string[];
  redaction_regions: RedactionRegion[];
  matched_texts: string[];
}

export interface RedactionResponse {
  status: string;
  file_id: string;
  new_cid: string | null;
  hash: string;
  redacted_by: string;
  anchor_tx?: string | null;
}

