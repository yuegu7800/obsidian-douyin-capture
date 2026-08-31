import {
  Notice,
  Plugin,
  addIcon,
} from "obsidian";
import {
  DEFAULT_SETTINGS,
  type DouyinPluginSettings,
} from "./settings";
import { MSG, formatExtractError } from "./messages";
import { checkHealth, extractContent, type ExtractMode } from "./backend";
import { writeNoteFromExtract, extractDouyinLink } from "./vaultWriter";
import { ExtractModal } from "./modal";
import { DouyinSettingTab } from "./settingTab";
import { DOUYIN_ICON_SVG } from "./icon";
import { DiscoveryModal } from "./discoveryModal";

export type ExtractStepState = "active" | "done";

export interface ExtractFlowOptions {
  mode?: ExtractMode;
  vaultStepIndex?: number;
  onStep?: (index: number, state: ExtractStepState) => void;
  silentSuccess?: boolean;
  openAfterCreate?: boolean;
}

export default class DouyinCapturePlugin extends Plugin {
  settings: DouyinPluginSettings = { ...DEFAULT_SETTINGS };
  readonly messages = MSG;

  async onload(): Promise<void> {
    await this.loadSettings();

    addIcon("douyin-capture", DOUYIN_ICON_SVG);

    this.addRibbonIcon("douyin-capture", "Douyin Capture：从链接创建笔记", () => {
      new ExtractModal(this).open();
    });

    this.addRibbonIcon("search", "Douyin Capture：搜索并导入知识", () => {
      new DiscoveryModal(this).open();
    });

    this.addSettingTab(new DouyinSettingTab(this.app, this));

    this.addCommand({
      id: "create-note-from-url",
      name: "从抖音链接创建笔记",
      callback: () => new ExtractModal(this).open(),
    });

    this.addCommand({
      id: "create-note-from-clipboard",
      name: "从剪贴板创建笔记",
      callback: () => void this.extractFromClipboard(),
    });

    this.addCommand({
      id: "check-backend",
      name: "检查后端连接",
      callback: () => void this.showHealthNotice(),
    });

    this.addCommand({
      id: "search-and-import-knowledge",
      name: "搜索并导入抖音知识",
      callback: () => new DiscoveryModal(this).open(),
    });

    window.setTimeout(() => void this.probeBackendOnStartup(), 3000);
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as
      | Partial<DouyinPluginSettings>
      | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async checkBackendStatus(): Promise<string> {
    const r = await checkHealth(this.settings.serverUrl);
    if (r.ok) {
      return MSG.settings.connected(this.settings.serverUrl);
    }
    return MSG.settings.disconnected;
  }

  private async probeBackendOnStartup(): Promise<void> {
    const r = await checkHealth(this.settings.serverUrl);
    if (!r.ok) {
      this.setStatusBar(MSG.statusBar.disconnected, () => {
        this.openSettingsTab();
      });
    }
  }

  private openSettingsTab(): void {
    const appWithSettings = this.app as typeof this.app & {
      setting?: {
        open(): void;
        openTabById(tabId: string): void;
      };
    };
    appWithSettings.setting?.open();
    appWithSettings.setting?.openTabById(this.manifest.id);
  }

  private statusBarEl: HTMLElement | null = null;

  private setStatusBar(text: string, onClick?: () => void): void {
    this.statusBarEl?.remove();
    const el = this.addStatusBarItem();
    el.setText(text);
    if (onClick) {
      el.onClickEvent(onClick);
      el.addClass("douyin-status-bar-clickable");
    }
    this.statusBarEl = el;
  }

  noticeError(title: string, body: string, duration = 8000): void {
    new Notice(`${title}\n\n${body}`, duration);
  }

  noticeSuccess(text: string): void {
    new Notice(text, 3000);
  }

  hasDouyinId(douyinId: string): boolean {
    return this.app.vault.getMarkdownFiles().some((file) => {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      return String(frontmatter?.douyin_id ?? "") === String(douyinId);
    });
  }

  async showHealthNotice(): Promise<void> {
    const r = await checkHealth(this.settings.serverUrl);
    if (r.ok) {
      this.noticeSuccess(`抖音后端：连接正常（${this.settings.serverUrl}）`);
    } else if (r.status) {
      this.noticeError(
        "本地服务异常",
        MSG.error.healthFail(r.status)
      );
    } else {
      this.noticeError(MSG.error.e01Title, MSG.error.e01Body);
    }
  }

  async extractFromClipboard(): Promise<void> {
    let clip = "";
    try {
      clip = await navigator.clipboard.readText();
    } catch {
      this.noticeError(MSG.error.e04Title, "无法读取剪贴板，请检查权限。");
      return;
    }
    const link = extractDouyinLink(clip) || clip.trim();
    if (!extractDouyinLink(link) && !clip.includes("douyin")) {
      this.noticeError(MSG.error.e04Title, MSG.error.e04Body);
      return;
    }
    await this.runExtractFlow(link, { mode: "full" });
  }

  async runExtractFlow(
    shareText: string,
    options: ExtractFlowOptions = {}
  ): Promise<boolean> {
    const mode = options.mode ?? "full";
    const onStep = options.onStep;
    const videoOnly = mode === "video_only";
    const vaultStep = options.vaultStepIndex ?? (videoOnly ? 4 : 5);

    onStep?.(0, "active");
    const health = await checkHealth(this.settings.serverUrl);
    if (!health.ok) {
      if (health.status) {
        this.noticeError(
          "本地服务异常",
          MSG.error.healthFail(health.status)
        );
      } else {
        this.noticeError(MSG.error.e01Title, MSG.error.e01Body);
      }
      return false;
    }
    onStep?.(0, "done");

    onStep?.(1, "active");
    let data;
    try {
      data = await extractContent(this.settings, shareText, mode);
    } catch (e) {
      onStep?.(1, "done");
      if (String(e).includes("INVALID_JSON")) {
        this.noticeError("服务响应异常", MSG.error.jsonInvalid);
      } else {
        this.noticeError(MSG.error.e01Title, String(e));
      }
      return false;
    }
    onStep?.(1, "done");

    if (!data.success) {
      this.noticeError(
        MSG.error.e05Title,
        formatExtractError(data.error)
      );
      return false;
    }

    if (
      !videoOnly &&
      !data.text?.trim() &&
      data.content_type === "video"
    ) {
      this.noticeError(MSG.error.e05Title, MSG.error.emptyText);
      return false;
    }

    if (this.hasDouyinId(data.video_id)) {
      if (!options.silentSuccess) {
        this.noticeSuccess(`已跳过重复作品：${data.title}`);
      }
      return true;
    }

    onStep?.(vaultStep, "active");
    try {
      const result = await writeNoteFromExtract(
        this.app,
        this.settings,
        data,
        { videoOnly }
      );
      onStep?.(vaultStep, "done");

      if (!options.silentSuccess) {
        if (result.partial && result.partialNotice) {
          this.noticeSuccess(result.partialNotice);
        } else if (videoOnly) {
          this.noticeSuccess(MSG.success.videoOnly(data.title));
        } else if (data.content_type === "image") {
          const n = data.images?.length ?? 0;
          this.noticeSuccess(MSG.success.image(data.title, n));
        } else {
          this.noticeSuccess(MSG.success.video(data.title));
        }
      }

      if (
        this.settings.openNoteAfterCreate &&
        options.openAfterCreate !== false
      ) {
        await this.app.workspace.getLeaf().openFile(result.file);
      }
      return true;
    } catch (e) {
      const msg = String(e);
      if (msg.startsWith("VAULT_WRITE:")) {
        const parts = msg.split(":");
        const detail = parts.slice(1, -1).join(":") || msg;
        const path = parts[parts.length - 1];
        this.noticeError(
          MSG.error.e11Title,
          `无法写入 ${path}：${detail}`
        );
      } else {
        this.noticeError(MSG.error.e05Title, msg);
      }
      return false;
    }
  }
}
