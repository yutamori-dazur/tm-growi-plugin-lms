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
      // 親の <pre> タグが white-space: pre / overflow-x: auto を持つため
      // クイズ内のテキストが折り返されずはみ出す。親要素のスタイルを上書きする。
      const parentPre = el.closest('pre');
      if (parentPre) {
        (parentPre as HTMLElement).style.whiteSpace = 'normal';
        (parentPre as HTMLElement).style.overflow = 'visible';
        (parentPre as HTMLElement).style.padding = '0';
        (parentPre as HTMLElement).style.background = 'none';
        (parentPre as HTMLElement).style.border = 'none';
      }
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
// AIチャットウィジェット注入
// ──────────────────────────────────────────

/** 復職名人AIアドバイザーのフローティングウィジェットを読み込む（1回のみ） */
function injectChatWidget(): void {
  if (document.querySelector('script[data-takao-widget]')) return;
  const s = document.createElement('script');
  s.src = 'https://chat.fukushoku-meijin.com/widget.js';
  s.defer = true;
  s.setAttribute('data-profile', 'member');
  s.setAttribute('data-color', '#1a661e');
  s.setAttribute('data-takao-widget', '1');
  document.body.appendChild(s);
}

// ──────────────────────────────────────────
// エントリーポイント
// ──────────────────────────────────────────

const activate = (): void => {
  if (growiFacade == null || growiFacade.markdownRenderer == null) {
    return;
  }

  // AIチャットウィジェットを注入する（認証済みユーザーにのみ表示）
  injectChatWidget();

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

  // Growi SPA ナビゲーション（戻る/進む含む）でキャッシュDOMが復元されると、
  // data-lms-mounted が付いたままだがReact rootが失われることがある。
  // 定期チェックで、マウント済みなのに中身が空のプレースホルダーを検知して再マウントする。
  setInterval(() => {
    const mounted = document.querySelectorAll('[data-lms-mounted]');
    let needsRemount = false;
    for (const el of mounted) {
      // React rootがマウントされていれば子要素がある。空なら再マウントが必要。
      if (el.childNodes.length === 0) {
        el.removeAttribute('data-lms-mounted');
        needsRemount = true;
      }
    }
    // マウント済みマークがなくて未マウントのプレースホルダーがあるか
    const unmounted = document.querySelectorAll('[data-lms-type]:not([data-lms-mounted])');
    if (needsRemount || unmounted.length > 0) {
      mountLmsComponents();
    }
  }, 1000);
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
