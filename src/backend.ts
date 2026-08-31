import { requestUrl } from "obsidian";
import { promises as fs } from "fs";
import { join } from "path";
import type {
  DouyinPluginSettings,
  ExtractResponse,
  DiscoveryResponse,
  MetaJson,
} from "./settings";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function checkHealth(
  serverUrl: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const resp = await requestUrl({
      url: `${normalizeBaseUrl(serverUrl)}/api/health`,
      method: "GET",
    });
    if (resp.status !== 200) {
      return { ok: false, status: resp.status };
    }
    const data = JSON.parse(resp.text) as { success?: boolean };
    return { ok: data.success === true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export type ExtractMode = "full" | "video_only";
export type DiscoveryMode = "search" | "related";

export async function discoverContent(
  settings: DouyinPluginSettings,
  mode: DiscoveryMode,
  value: string,
  limit = 20
): Promise<DiscoveryResponse> {
  const base = normalizeBaseUrl(settings.serverUrl);
  const endpoint = mode === "search" ? "search" : "related";
  const payload = mode === "search"
    ? { query: value, limit }
    : { url: value, limit };
  const resp = await requestUrl({
    url: `${base}/api/video/${endpoint}`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: DiscoveryResponse;
  try {
    data = JSON.parse(resp.text) as DiscoveryResponse;
  } catch {
    return { success: false, error: "搜索服务返回了无法识别的数据" };
  }
  if (resp.status >= 400 || !data.success) {
    return {
      success: false,
      error: data.error || `HTTP ${resp.status}`,
    };
  }
  return data;
}

export async function extractContent(
  settings: DouyinPluginSettings,
  shareUrl: string,
  mode: ExtractMode = "full"
): Promise<ExtractResponse> {
  const base = normalizeBaseUrl(settings.serverUrl);
  const resp = await requestUrl({
    url: `${base}/api/video/extract`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: shareUrl,
      model: settings.whisperModel,
      transcript_mode: settings.transcriptMode,
      skip_transcribe: mode === "video_only",
    }),
  });

  let data: ExtractResponse;
  try {
    data = JSON.parse(resp.text) as ExtractResponse;
  } catch {
    throw new Error("INVALID_JSON");
  }

  if (resp.status >= 400 || !data.success) {
    const err = !data.success ? data.error : `HTTP ${resp.status}`;
    return { success: false, error: err };
  }

  const meta = await readMetaJson(data.out_dir);
  if (meta?.source_url) {
    data.source_url = meta.source_url;
  }
  if (meta?.transcript_source) {
    data.transcript_source = meta.transcript_source;
  }
  return data;
}

async function readMetaJson(outDir: string): Promise<MetaJson | null> {
  try {
    const raw = await fs.readFile(join(outDir, "meta.json"), "utf-8");
    return JSON.parse(raw) as MetaJson;
  } catch {
    return null;
  }
}
