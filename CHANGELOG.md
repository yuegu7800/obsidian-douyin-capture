# Changelog

## 1.1.0

- Add multi-link batch import with per-item progress and failure isolation.
- Skip content already stored in the vault by `douyin_id`.
- Add Douyin search and a dedicated related-content workflow.
- Add transcription modes: smart auto, OCR first, and speech recognition.
- Prefer local OCR for videos with visible captions and image posts.
- Keep compatibility with `/api/health`, `/api/video/info`, and `/api/video/extract`.
- Support knowledge-first backend cleanup so temporary video/audio do not occupy storage after extraction.

## 1.0.5 and earlier

Original releases by lyxdream. See the repository history and LICENSE for attribution.
