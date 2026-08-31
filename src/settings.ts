export interface DouyinPluginSettings {
  serverUrl: string;
  whisperModel: string;
  transcriptMode: "auto" | "ocr" | "asr";
  noteFolder: string;
  attachmentFolder: string;
  embedVideo: boolean;
  openNoteAfterCreate: boolean;
}

export const DEFAULT_SETTINGS: DouyinPluginSettings = {
  serverUrl: "http://127.0.0.1:5050",
  whisperModel: "medium",
  transcriptMode: "auto",
  noteFolder: "Douyin",
  attachmentFolder: "attachments/douyin",
  embedVideo: true,
  openNoteAfterCreate: true,
};

export interface ExtractResult {
  success: true;
  video_id: string;
  title: string;
  author: string;
  content_type: "video" | "image";
  download_url: string;
  text: string;
  out_dir: string;
  images: string[];
  source_url?: string;
  transcript_source?: "video_ocr" | "image_ocr" | "asr" | "description";
}

export interface ExtractError {
  success: false;
  error: string;
}

export type ExtractResponse = ExtractResult | ExtractError;

export interface MetaJson {
  aweme_id?: string;
  title?: string;
  author?: string;
  content_type?: string;
  source_url?: string;
  download_url?: string;
  transcript_source?: "video_ocr" | "image_ocr" | "asr" | "description";
}

export interface DiscoveryItem {
  video_id: string;
  aweme_id: string;
  title: string;
  author: string;
  content_type: "video" | "image";
  source_url: string;
  cover_url?: string | null;
}

export interface DiscoveryResponse {
  success: boolean;
  count?: number;
  items?: DiscoveryItem[];
  error?: string;
}
