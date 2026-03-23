/**
 * growi-plugin-lms — クライアントエントリーポイント。
 *
 * 2段階方式:
 * 1. growiFacade で code コンポーネントを差し替え、LMSマーカーを
 *    data属性付きの空divに変換する（hooks不使用、Growi側Reactで描画）
 * 2. MutationObserver でその空divを検知し、プラグイン側の独自React root で
 *    インタラクティブなコンポーネントをマウントする（hooks使用OK）
 */

import React from 'react';
import { createRoot } from 'react-dom/client';

import config from './package.json';
import { AdminDashboard } from './src/AdminDashboard';
import { Dashboard } from './src/Dashboard';
import { LessonCompleteButton } from './src/LessonCompleteButton';
import { ProgressIndicator } from './src/ProgressIndicator';
import { QuizRenderer } from './src/QuizRenderer';
import { parseQuizYaml } from './src/yamlParser';

/** activate時に取得したユーザーID */
let currentUserId: string | null = null;

/** マウント済みのルートを追跡 */
const mountedRoots = new Map<Element, ReturnType<typeof createRoot>>();

declare const growiFacade: any;

// ──────────────────────────────────────────
// Stage 1: growiFacade でコードブロックをプレースホルダーdivに差し替え
// （Growi側のReactで描画されるため、hooks は使えない）
// ──────────────────────────────────────────

function withLmsPlaceholders(OriginalCode: React.ComponentType<any>) {
  return function LmsPlaceholder(props: any) {
    const { className, children } = props;
    const lang = (className ?? '').replace('language-', '');

    if (
      lang === 'lms:lesson-complete' ||
      lang === 'lms:progress' ||
      lang === 'lms:dashboard' ||
      lang === 'lms:admin-dashboard'
    ) {
      const text = typeof children === 'string' ? children : String(children ?? '');
      // data属性付きの空divを返す（Stage 2で検知してマウント）
      const typeMap: Record<string, string> = {
        'lms:lesson-complete': 'lesson-complete',
        'lms:progress': 'progress',
        'lms:dashboard': 'dashboard',
        'lms:admin-dashboard': 'admin-dashboard',
      };
      return React.createElement('div', {
        'data-lms-type': typeMap[lang] ?? lang,
        'data-lms-props': text.trim(),
        style: { minHeight: '48px' },
      });
    }

    if (lang === 'yaml:quiz') {
      const text = typeof children === 'string' ? children : String(children ?? '');
      return React.createElement('div', {
        'data-lms-type': 'quiz',
        'data-lms-props': text.trim(),
        style: { minHeight: '100px' },
      });
    }

    return React.createElement(OriginalCode, props);
  };
}

// ──────────────────────────────────────────
// Stage 2: プレースホルダーを検知して独自Reactルートをマウント
// （プラグイン側のReactなので hooks が使える）
// ──────────────────────────────────────────

function parseProps(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function mountLmsComponents(): void {
  const placeholders = document.querySelectorAll('[data-lms-type]:not([data-lms-mounted])');

  for (const el of placeholders) {
    const type = el.getAttribute('data-lms-type');
    const propsText = el.getAttribute('data-lms-props') ?? '';
    const parsed = parseProps(propsText);

    // マウント済みマーク（二重マウント防止）
    el.setAttribute('data-lms-mounted', 'true');

    const root = createRoot(el as HTMLElement);
    mountedRoots.set(el, root);

    if (type === 'lesson-complete') {
      if (!parsed.courseId || !parsed.pagePath || !currentUserId) continue;
      root.render(
        React.createElement(LessonCompleteButton, {
          courseId: parsed.courseId,
          pagePath: parsed.pagePath,
          userId: currentUserId,
        }),
      );
    } else if (type === 'progress') {
      if (!parsed.courseId || !currentUserId) continue;
      root.render(
        React.createElement(ProgressIndicator, {
          courseId: parsed.courseId,
          userId: currentUserId,
        }),
      );
    } else if (type === 'dashboard') {
      if (!currentUserId) continue;
      root.render(React.createElement(Dashboard, { userId: currentUserId }));
    } else if (type === 'quiz') {
      const quizData = parseQuizYaml(propsText, parsed.courseId ?? 'unknown');
      if (!quizData) continue;
      root.render(React.createElement(QuizRenderer, { quizData }));
    } else if (type === 'admin-dashboard') {
      // 管理者ダッシュボード（ユーザーIDは不要。API側で認証・権限確認を行う）
      root.render(React.createElement(AdminDashboard));
    }
  }
}

// ──────────────────────────────────────────
// ユーザーID取得
// ──────────────────────────────────────────

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

// ──────────────────────────────────────────
// エントリーポイント
// ──────────────────────────────────────────

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    return;
  }

  // ユーザーID取得（非同期、完了後にマウント再試行）
  fetchUserId().then((id) => {
    currentUserId = id;
    // ID取得完了後に既存のプレースホルダーをマウント
    mountLmsComponents();
  });

  // Stage 1: growiFacade でコードブロックをプレースホルダーに差し替え
  const { optionsGenerators } = growiFacade.markdownRenderer;

  const originalCustomViewOptions = optionsGenerators.customGenerateViewOptions;
  optionsGenerators.customGenerateViewOptions = (...args: any[]) => {
    const options = originalCustomViewOptions
      ? originalCustomViewOptions(...args)
      : optionsGenerators.generateViewOptions(...args);
    const OriginalCode = options.components.code;
    options.components.code = withLmsPlaceholders(OriginalCode);
    return options;
  };

  const originalCustomPreviewOptions = optionsGenerators.customGeneratePreviewOptions;
  optionsGenerators.customGeneratePreviewOptions = (...args: any[]) => {
    const options = originalCustomPreviewOptions
      ? originalCustomPreviewOptions(...args)
      : optionsGenerators.generatePreviewOptions(...args);
    const OriginalCode = options.components.code;
    options.components.code = withLmsPlaceholders(OriginalCode);
    return options;
  };

  // Stage 2: MutationObserver でプレースホルダーの出現を監視
  const observer = new MutationObserver(() => {
    mountLmsComponents();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // SPA戻る/進むでGrowiがキャッシュDOMを復元したとき、
  // data-lms-mounted が付いたままだがReact rootが失われている。
  // popstate で全マウントをリセットして再マウントする。
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      // 既存のマウント済みマークをクリアして再スキャン
      document.querySelectorAll('[data-lms-mounted]').forEach((el) => {
        el.removeAttribute('data-lms-mounted');
      });
      mountLmsComponents();
    }, 500);
  });
};

const deactivate = (): void => {
  for (const [el, root] of mountedRoots) {
    root.unmount();
  }
  mountedRoots.clear();
};

if ((window as any).pluginActivators == null) {
  (window as any).pluginActivators = {};
}
(window as any).pluginActivators[config.name] = { activate, deactivate };
