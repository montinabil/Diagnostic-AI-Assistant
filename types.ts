
export enum View {
  DASHBOARD = 'DASHBOARD',
  ANALYZE = 'ANALYZE',
  CHAT = 'CHAT',
  RESOURCES = 'RESOURCES',
  CASE_DETAILS = 'CASE_DETAILS',
}

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
}

export interface AnalysisResult {
  text: string;
  groundingChunks?: Array<{
    web?: { uri: string; title: string };
  }>;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  isError?: boolean;
}

export interface ResourceItem {
  id: string;
  title: string;
  type: 'Article' | 'Case Study' | 'ImageRef' | 'Document';
  date: string;
  description: string;
  fileData?: string; // base64
  mimeType?: string;
  summary?: string;
}

export type AnnotationShape = 'rectangle' | 'circle' | 'arrow';

export interface XRayROI {
  id: string;
  shape: AnnotationShape;
  color: string; // e.g. '#06b6d4' (cyan), '#f59e0b' (amber), '#ef4444' (red), '#10b981' (emerald), '#a855f7' (purple)
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width?: number; // percentage (0 - 100)
  height?: number; // percentage (0 - 100)
  endX?: number; // percentage (0 - 100) for arrow destination
  endY?: number; // percentage (0 - 100) for arrow destination
  rotation?: number; // rotation in degrees (0 - 360)
  label: string; // descriptive label, e.g. "Right lower zone consolidation"
  anatomicalLocation?: string; // computed anatomical quadrant / location
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  specialty?: string;
  institution?: string;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  userId?: string;
  type: 'image' | 'video' | 'mixed' | 'xray';
  modality?: 'ultrasound' | 'xray';
  preview: string; // base64 (main thumbnail)
  media: Array<{ type: 'image' | 'video', preview: string }>; // Full media list
  description: string;
  date: string;
  timestamp: number;
  result: AnalysisResult;
  roi?: XRayROI; // Backward compatibility with single ROI
  rois?: XRayROI[]; // Array of multiple target ROIs
}


