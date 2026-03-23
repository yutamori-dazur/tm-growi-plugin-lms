/**
 * growi-plugin-lms — クライアントエントリーポイント。
 *
 * growiFacade.markdownRenderer を使い、特定言語のコードブロックを
 * LMSコンポーネントに差し替える。
 *
 * マーカー:
 *   ```lms:lesson-complete   → LessonCompleteButton
 *   ```lms:progress          → ProgressIndicator
 *   ```yaml:quiz             → QuizRenderer
 */

import React from 'react';

import config from './package.json';
import { LessonCompleteButton } from './src/LessonCompleteButton';
import { ProgressIndicator } from './src/ProgressIndicator';
import { QuizRenderer } from './src/QuizRenderer';
import { parseQuizYaml } from './src/yamlParser';

declare const growiFacade: any;

/**
 * コードブロックの子要素（文字列）からキーバリューを抽出する。
 * 例: "courseId: intro" → { courseId: "intro" }
 */
function parseProps(children: any): Record<string, string> {
  const text = typeof children === 'string' ? children : String(children ?? '');
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/** activate() で取得したユーザーIDを保持する */
let currentUserId: string | null = null;

/**
 * LMS API の /auth/me を呼んでユーザーIDを取得する。
 * Growiと同一ドメインなので connect.sid Cookie が自動送信される。
 */
async function fetchUserId(): Promise<string | null> {
  try {
    const res = await fetch('/api/lms/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * 現在のページパスを取得する。
 */
function getPagePath(): string {
  return decodeURIComponent(window.location.pathname);
}

/**
 * 元のCodeコンポーネントをラップし、LMS用の言語指定のコードブロックを
 * LMSコンポーネントに差し替える高階コンポーネント。
 */
function withLmsComponents(OriginalCode: React.ComponentType<any>) {
  return function LmsCodeWrapper(props: any) {
    const { className, children, ...rest } = props;
    const lang = (className ?? '').replace('language-', '');

    // lms:lesson-complete → 完了ボタン
    if (lang === 'lms:lesson-complete') {
      const parsed = parseProps(children);
      const courseId = parsed.courseId;
      if (!courseId) return null;

      if (!currentUserId) return React.createElement('div', { style: { color: '#999' } }, 'ログインが必要です');

      const pagePath = getPagePath();
      return React.createElement(LessonCompleteButton, { courseId, pagePath, userId: currentUserId });
    }

    // lms:progress → 進捗バー
    if (lang === 'lms:progress') {
      const parsed = parseProps(children);
      const courseId = parsed.courseId;
      if (!courseId) return null;

      if (!currentUserId) return React.createElement('div', { style: { color: '#999' } }, 'ログインが必要です');

      return React.createElement(ProgressIndicator, { courseId, userId: currentUserId });
    }

    // yaml:quiz → クイズUI
    if (lang === 'yaml:quiz') {
      const yamlText = typeof children === 'string' ? children : String(children ?? '');
      // courseId を同ページの他のLMSマーカーから推定するのは困難なので、
      // YAMLパーサーにフォールバック用courseIdを渡す
      const quizData = parseQuizYaml(yamlText, 'unknown');
      if (!quizData) {
        console.warn('[growi-plugin-lms] yaml:quiz のパースに失敗しました');
        return React.createElement(OriginalCode, props);
      }

      return React.createElement(QuizRenderer, { quizData });
    }

    // その他のコードブロックは元のコンポーネントで表示
    return React.createElement(OriginalCode, props);
  };
}

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    return;
  }

  // ユーザーIDを非同期で取得（コンポーネント初回レンダリング時にはnullの可能性あり）
  fetchUserId().then((id) => {
    currentUserId = id;
  });

  const { optionsGenerators } = growiFacade.markdownRenderer;

  // ビュー用レンダラーをカスタマイズ
  const originalCustomViewOptions = optionsGenerators.customGenerateViewOptions;
  optionsGenerators.customGenerateViewOptions = (...args: any[]) => {
    const options = originalCustomViewOptions
      ? originalCustomViewOptions(...args)
      : optionsGenerators.generateViewOptions(...args);

    const OriginalCode = options.components.code;
    options.components.code = withLmsComponents(OriginalCode);

    return options;
  };

  // プレビュー用レンダラーもカスタマイズ
  const originalCustomPreviewOptions = optionsGenerators.customGeneratePreviewOptions;
  optionsGenerators.customGeneratePreviewOptions = (...args: any[]) => {
    const options = originalCustomPreviewOptions
      ? originalCustomPreviewOptions(...args)
      : optionsGenerators.generatePreviewOptions(...args);

    const OriginalCode = options.components.code;
    options.components.code = withLmsComponents(OriginalCode);

    return options;
  };
};

const deactivate = (): void => {
};

// Growi プラグインシステムへの登録
if ((window as any).pluginActivators == null) {
  (window as any).pluginActivators = {};
}
(window as any).pluginActivators[config.name] = {
  activate,
  deactivate,
};
