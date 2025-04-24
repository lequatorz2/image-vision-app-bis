// Metadata structure from Gemini vision analysis
export interface ImageMetadata {
  medium?: string;              // Photography, Painting, Digital Art, etc.
  people?: {
    number?: number;            // Number of people detected
    gender?: string;            // Gender description
  };
  actions?: string;             // Running, dancing, sitting, etc.
  clothes?: string;             // Formal, casual, sportswear, etc.
  environment?: string;         // Indoor, outdoor, city, nature, etc.
  colors?: string[];            // Top 2 dominant colors
  style?: string;               // Abstract, realistic, vintage, modern, etc.
  mood?: string;                // Happy, dramatic, nostalgic, etc.
  scene: string;                // Description of the scene (40-50 words)
}

// Image item structure
export interface Image {
  id: string;
  fileName: string;
  url: string;
  thumbnailUrl?: string;
  uploadDate: string;
  fileSize?: number;
  mimeType?: string;
  metadata: ImageMetadata;
  similarityScore?: number;     // Used for related images
}

// Search filter structure
export interface SearchFilter {
  field: string;
  value: string;
}

// Search query structure
export interface SearchQuery {
  query: string;
  filters: Record<string, string>;
}

// Stats response structure
export interface StatsResponse {
  totalImages: number;
  storageUsed: number;
  uniqueCategories: number;
  totalPeople: number;
  topStyles?: Array<{value: string, count: number}>;
  topEnvironments?: Array<{value: string, count: number}>;
  topMoods?: Array<{value: string, count: number}>;
  topColors?: Array<{value: string, count: number}>;
}