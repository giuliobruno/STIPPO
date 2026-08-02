export type PlanTier = "free" | "pro" | "team";

export type MediaType = "image" | "audio" | "document";
export type MemorySource =
  | "camera"
  | "upload"
  | "paste"
  | "voice"
  | "share"
  | "screenshot"
  | "extension";

export type ClipRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
};
export type MemoryStatus = "processing" | "ready" | "failed";
export type IntentType =
  | "remember"
  | "decision"
  | "supplier"
  | "reference"
  | "question"
  | "other";

export interface MemoryEntities {
  materials: string[];
  people: string[];
  companies: string[];
  locations: string[];
  concepts: string[];
  projects: string[];
}

export interface ImageAnalysisResult {
  title: string;
  description: string;
  objects: string[];
  tags: string[];
  ocrText: string;
  entities: MemoryEntities;
  projectSuggested?: string;
}

export interface AudioAnalysisResult {
  transcript: string;
  intent: IntentType;
  summary: string;
  entities: MemoryEntities;
  projectSuggested?: string;
}

export interface MemoryAnalysisResult {
  title: string;
  description: string;
  aiSummary: string;
  objects: string[];
  tags: string[];
  ocrText: string;
  transcript?: string;
  intent?: IntentType;
  entities: MemoryEntities;
  projectSuggested?: string;
  searchText: string;
}

export interface StoragePutResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface SearchHit {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  projectName: string | null;
  score: number;
  createdAt: string;
}
