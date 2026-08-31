import { Modal } from "obsidian";
import type DouyinCapturePlugin from "./main";
import {
  discoverContent,
  type DiscoveryMode,
} from "./backend";
import type { DiscoveryItem } from "./settings";

const RESULT_LIMIT = 20;
const DEFAULT_SELECTED = 5;
const MAX_SELECTED = 10;

export class DiscoveryModal extends Modal {
  private mode: DiscoveryMode = "search";
  private value = "";
  private resultsEl: HTMLElement | null = null;
  private actionEl: HTMLElement | null = null;
  private busy = false;

  constructor(private plugin: DouyinCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass("douyin-discovery-modal-container");
    const wrap = contentEl.createDiv({ cls: "douyin-discovery-modal" });
    wrap.createEl("h2", { text: "搜索抖音知识" });
    wrap.createEl("p", {
      cls: "douyin-modal-desc",
      text: "搜索展示 20 条候选，默认选择 5 条，单次最多导入 10 条。",
    });

    const controls = wrap.createDiv({ cls: "douyin-discovery-controls" });
    const select = controls.createEl("select");
    select.createEl("option", { text: "关键词搜索", value: "search" });
    select.createEl("option", { text: "相关推荐", value: "related" });
    select.addEventListener("change", () => {
      this.mode = select.value as DiscoveryMode;
      input.placeholder = this.mode === "search"
        ? "例如：爱情、亲密关系、沟通"
        : "粘贴一个抖音视频链接";
    });

    const input = controls.createEl("input", {
      type: "text",
      attr: { placeholder: "例如：爱情、亲密关系、沟通" },
    });
    input.addEventListener("input", () => {
      this.value = input.value.trim();
    });
    controls
      .createEl("button", { text: "搜索", cls: "mod-cta" })
      .addEventListener("click", () => void this.search());

    this.resultsEl = wrap.createDiv({ cls: "douyin-discovery-results" });
    this.actionEl = wrap.createDiv({ cls: "douyin-discovery-actions" });
  }

  private async search(): Promise<void> {
    if (this.busy || !this.resultsEl || !this.actionEl) return;
    if (!this.value) {
      this.plugin.noticeError(
        "请输入搜索内容",
        this.mode === "search" ? "请输入关键词。" : "请粘贴来源视频链接。"
      );
      return;
    }
    this.busy = true;
    this.resultsEl.empty();
    this.actionEl.empty();
    this.resultsEl.createEl("p", { text: "正在搜索，请稍候…" });
    try {
      const response = await discoverContent(
        this.plugin.settings,
        this.mode,
        this.value,
        RESULT_LIMIT
      );
      if (!response.success) {
        this.resultsEl.empty();
        this.resultsEl.createEl("p", { text: response.error || "搜索失败" });
        return;
      }
      this.renderResults(response.items ?? []);
    } finally {
      this.busy = false;
    }
  }

  private renderResults(items: DiscoveryItem[]): void {
    if (!this.resultsEl || !this.actionEl) return;
    this.resultsEl.empty();
    this.actionEl.empty();
    if (items.length === 0) {
      this.resultsEl.createEl("p", { text: "没有找到可导入的结果。" });
      return;
    }

    const selected = new Map<string, DiscoveryItem>();
    let initialCount = 0;
    for (const item of items) {
      const exists = this.plugin.hasDouyinId(item.video_id);
      const row = this.resultsEl.createDiv({
        cls: `douyin-discovery-row${exists ? " is-existing" : ""}`,
      });
      const checkbox = row.createEl("input", { type: "checkbox" });
      checkbox.disabled = exists;
      if (!exists && initialCount < DEFAULT_SELECTED) {
        checkbox.checked = true;
        selected.set(item.video_id, item);
        initialCount++;
      }
      checkbox.addEventListener("change", () => {
        if (checkbox.checked && selected.size >= MAX_SELECTED) {
          checkbox.checked = false;
          this.plugin.noticeError("已达到上限", "单次最多导入 10 条。");
          return;
        }
        if (checkbox.checked) selected.set(item.video_id, item);
        else selected.delete(item.video_id);
        updateButton();
      });
      const text = row.createDiv({ cls: "douyin-discovery-item-text" });
      text.createDiv({ cls: "douyin-discovery-title", text: item.title });
      text.createDiv({
        cls: "douyin-discovery-meta",
        text: exists
          ? `${item.author || "未知"} · 已入库`
          : `${item.author || "未知"} · ${item.content_type === "image" ? "图文" : "视频"}`,
      });
    }

    const button = this.actionEl.createEl("button", { cls: "mod-cta" });
    const updateButton = (): void => {
      button.setText(`导入选中内容（${selected.size}）`);
      button.disabled = selected.size === 0;
    };
    updateButton();
    button.addEventListener("click", () =>
      void this.importSelected([...selected.values()], button)
    );
  }

  private async importSelected(
    items: DiscoveryItem[],
    button: HTMLButtonElement
  ): Promise<void> {
    if (this.busy || items.length === 0) return;
    this.busy = true;
    button.disabled = true;
    let success = 0;
    try {
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        button.setText(`正在导入 ${index + 1}/${items.length}`);
        if (this.plugin.hasDouyinId(item.video_id)) continue;
        const ok = await this.plugin.runExtractFlow(item.source_url, {
          mode: "full",
          silentSuccess: true,
          openAfterCreate: false,
        });
        if (ok) success++;
      }
      this.plugin.noticeSuccess(
        `知识入库完成：成功 ${success} 条，跳过或失败 ${items.length - success} 条`
      );
      this.close();
    } finally {
      this.busy = false;
    }
  }

  onClose(): void {
    this.modalEl.removeClass("douyin-discovery-modal-container");
    this.contentEl.empty();
  }
}
