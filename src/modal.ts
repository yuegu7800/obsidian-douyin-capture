import { Modal } from "obsidian";
import { MSG } from "./messages";
import type DouyinCapturePlugin from "./main";
import type { ExtractMode } from "./backend";
import { extractDouyinLinks } from "./vaultWriter";

type StepState = "pending" | "active" | "done";

export class ExtractModal extends Modal {
  private url = "";
  private running = false;
  private progressEl: HTMLElement | null = null;
  private stepEls: HTMLElement[] = [];
  private inputEl: HTMLTextAreaElement | null = null;
  private extractBtn: HTMLButtonElement | null = null;
  private videoOnlyBtn: HTMLButtonElement | null = null;
  private rotateTimer: number | null = null;

  constructor(private plugin: DouyinCapturePlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    modalEl.addClass("douyin-extract-modal-container");

    const wrap = contentEl.createDiv({ cls: "douyin-extract-modal" });

    wrap.createEl("h2", { text: "import douyin" });
    wrap.createEl("p", {
      cls: "douyin-modal-desc",
      text: "粘贴一个或多个抖音分享链接；批量时每行一条即可",
    });

    this.inputEl = wrap.createEl("textarea", {
      cls: "douyin-modal-input",
      attr: {
        placeholder: "https://...\nhttps://...",
        rows: "5",
      },
    });
    this.inputEl.addEventListener("input", () => {
      this.url = this.inputEl?.value ?? "";
    });

    this.progressEl = wrap.createDiv({ cls: "douyin-modal-progress is-hidden" });

    const footer = wrap.createDiv({ cls: "douyin-modal-footer" });
    footer
      .createEl("button", { text: "取消", cls: "douyin-btn-cancel" })
      .addEventListener("click", () => this.close());

    this.videoOnlyBtn = footer.createEl("button", {
      text: "提取视频",
      cls: "douyin-btn-secondary",
    });
    this.videoOnlyBtn.addEventListener("click", () =>
      void this.run("video_only")
    );

    this.extractBtn = footer.createEl("button", {
      text: "提取文案",
      cls: "mod-cta douyin-btn-primary",
    });
    this.extractBtn.addEventListener("click", () => void this.run("full"));
  }

  private setButtonsEnabled(enabled: boolean): void {
    this.extractBtn?.toggleAttribute("disabled", !enabled);
    this.videoOnlyBtn?.toggleAttribute("disabled", !enabled);
    this.inputEl?.toggleAttribute("disabled", !enabled);
  }

  private buildSteps(mode: ExtractMode): string[] {
    if (mode === "video_only") {
      return [
        MSG.steps.health,
        MSG.steps.resolve,
        MSG.steps.download,
        MSG.steps.videoOnly,
        MSG.steps.vault,
      ];
    }
    return [
      MSG.steps.health,
      MSG.steps.resolve,
      MSG.steps.download,
      MSG.steps.audio,
      MSG.steps.whisper,
      MSG.steps.vault,
    ];
  }

  private backendStepRange(mode: ExtractMode): { start: number; end: number } {
    if (mode === "video_only") {
      return { start: 1, end: 3 };
    }
    return { start: 1, end: 4 };
  }

  private vaultStepIndex(mode: ExtractMode): number {
    return this.buildSteps(mode).length - 1;
  }

  private loadingCopy(mode: ExtractMode): { main: string; sub: string; hint: string } {
    if (mode === "video_only") {
      return {
        main: "提取中",
        sub: MSG.loading.videoOnly.main,
        hint: MSG.loading.videoOnly.sub,
      };
    }
    return {
      main: "提取中",
      sub: MSG.loading.extractVideo.main,
      hint: `${MSG.loading.extractVideo.sub}，请勿关闭 Obsidian`,
    };
  }

  private showProgress(mode: ExtractMode): void {
    if (!this.progressEl) return;
    this.progressEl.removeClass("is-hidden");
    this.progressEl.empty();
    this.stepEls = [];

    const copy = this.loadingCopy(mode);
    const panel = this.progressEl.createDiv({ cls: "douyin-progress-panel" });

    const header = panel.createDiv({ cls: "douyin-progress-header" });
    header.createDiv({ cls: "douyin-progress-spinner" });
    const textWrap = header.createDiv({ cls: "douyin-progress-text" });
    textWrap.createDiv({ cls: "douyin-progress-main", text: copy.main });
    textWrap.createDiv({ cls: "douyin-progress-sub", text: copy.sub });

    panel.createEl("p", {
      cls: "douyin-progress-hint",
      text: copy.hint,
    });
    panel.createDiv({ cls: "douyin-progress-section", text: "处理进度" });

    const ul = panel.createEl("ul", { cls: "douyin-modal-steps" });
    this.renderStepList(ul, this.buildSteps(mode));
  }

  private renderStepList(container: HTMLElement, labels: string[]): void {
    labels.forEach((label, index) => {
      const li = container.createEl("li", { cls: "douyin-step is-pending" });
      li.dataset.stepIndex = String(index + 1);
      li.createSpan({ cls: "douyin-step-dot" });
      li.createSpan({ cls: "douyin-step-label", text: label });
      this.stepEls.push(li);
    });
  }

  private setStep(index: number, state: StepState): void {
    const el = this.stepEls[index];
    if (!el) return;
    el.removeClass("is-pending", "is-active", "is-done");
    el.addClass(`is-${state}`);
    const dot = el.querySelector(".douyin-step-dot");
    if (dot) {
      dot.empty();
      if (state === "active") {
        dot.setText(String(index + 1));
      }
    }
  }

  private markStepsDone(until: number): void {
    for (let i = 0; i < until; i++) this.setStep(i, "done");
  }

  private startBackendSubsteps(mode: ExtractMode): void {
    this.stopRotateTimer();
    const { start, end } = this.backendStepRange(mode);
    const quickSteps: number[] = [];
    for (let i = start; i < end; i++) quickSteps.push(i);

    const finishQuickSteps = (index: number): void => {
      if (index >= quickSteps.length) {
        this.setStep(end, "active");
        return;
      }
      const step = quickSteps[index];
      this.setStep(step, "active");
      this.rotateTimer = window.setTimeout(() => {
        this.setStep(step, "done");
        finishQuickSteps(index + 1);
      }, 480);
    };

    if (quickSteps.length === 0) {
      this.setStep(end, "active");
    } else {
      finishQuickSteps(0);
    }
  }

  private finishBackendSubsteps(mode: ExtractMode): void {
    this.stopRotateTimer();
    const { end } = this.backendStepRange(mode);
    for (let i = 1; i <= end; i++) {
      this.setStep(i, "done");
    }
  }

  private stopRotateTimer(): void {
    if (this.rotateTimer != null) {
      window.clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
  }

  private async run(mode: ExtractMode): Promise<void> {
    if (this.running) return;
    const trimmed = this.url.trim();
    if (!trimmed) {
      this.plugin.noticeError(MSG.error.e03Title, MSG.error.e03Body);
      return;
    }

    const links = extractDouyinLinks(trimmed);
    if (links.length === 0) {
      this.plugin.noticeError(MSG.error.e04Title, MSG.error.e04Body);
      return;
    }

    this.running = true;
    this.setButtonsEnabled(false);

    try {
      let successCount = 0;
      for (let itemIndex = 0; itemIndex < links.length; itemIndex++) {
        this.showProgress(mode);
        if (links.length > 1) {
          this.progressEl
            ?.querySelector(".douyin-progress-main")
            ?.setText(`批量提取 ${itemIndex + 1}/${links.length}`);
        }
        const vaultIndex = this.vaultStepIndex(mode);
        const ok = await this.plugin.runExtractFlow(links[itemIndex], {
          mode,
          vaultStepIndex: vaultIndex,
          silentSuccess: links.length > 1,
          openAfterCreate: links.length === 1,
          onStep: (index, state) => {
            if (state === "active") {
              this.markStepsDone(index);
              this.setStep(index, "active");
              if (index === 1) this.startBackendSubsteps(mode);
            } else if (state === "done") {
              if (index === 1) this.finishBackendSubsteps(mode);
              else this.setStep(index, "done");
            }
          },
        });
        if (ok) successCount++;
        this.markStepsDone(this.stepEls.length);
      }
      if (links.length > 1) {
        this.plugin.noticeSuccess(
          `批量处理完成：成功 ${successCount} 条，失败 ${links.length - successCount} 条`
        );
      }
      this.close();
    } finally {
      this.stopRotateTimer();
      this.running = false;
      this.setButtonsEnabled(true);
    }
  }

  onClose(): void {
    this.stopRotateTimer();
    this.modalEl.removeClass("douyin-extract-modal-container");
    this.contentEl.empty();
  }
}
