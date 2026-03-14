// Document Activity Timeline types

export type TimelineEventType =
  | 'upload'
  | 'encrypt'
  | 'scan'
  | 'detect'
  | 'redact_review'
  | 'redact'
  | 'proof'
  | 'anchor'
  | 'compliance'
  | 'certificate'
  | 'share'
  | 'download';

export type TimelineEventStatus = 'success' | 'pending' | 'failed';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  action: string;
  description?: string;
  timestamp: string; // ISO string from API
  status: TimelineEventStatus;
  actor?: string;
  metadata?: Record<string, string>;
  /** Label for the interactive action button, e.g. "View proof details" */
  actionLabel?: string;
  /** Action type identifier, e.g. "view_proof", "view_tx", "view_report", "open_certificate" */
  actionType?: string;
}
