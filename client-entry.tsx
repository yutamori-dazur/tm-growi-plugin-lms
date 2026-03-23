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

/**
 * 現在ログイン中のユーザーIDを取得する。
 * Growi の window 上のユーザー情報から取得を試みる。
 */
function getUserId(): string | null {
  try {
    // Growi v7 では window 上にユーザー情報がある場合がある
    const appContainer = document.getElementById('growi');
    if (appContainer) {
      const dataset = appContainer.dataset;
      if (dataset.currentUserId) return dataset.currentUserId;
    }
    // body の data 属性からも試みる
    const body = document.body;
    if (body.dataset.currentUserId) return body.dataset.currentUserId;
  } catch {
    // 無視
  }
  return null;
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

      const userId = getUserId();
      if (!userId) return React.createElement('div', { style: { color: '#999' } }, 'ログインが必要です');

      const pagePath = getPagePath();
      return React.createElement(LessonCompleteButton, { courseId, pagePath, userId });
    }

    // lms:progress → 進捗バー
    if (lang === 'lms:progress') {
      const parsed = parseProps(children);
      const courseId = parsed.courseId;
      if (!courseId) return null;

      const userId = getUserId();
      if (!userId) return React.createElement('div', { style: { color: '#999' } }, 'ログインが必要です');

      return React.createElement(ProgressIndicator, { courseId, userId });
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
