/**
 * growi-plugin-lms — クライアントエントリーポイント。
 *
 * ページ内のコードブロックマーカーを検知してLMSコンポーネントを注入する。
 *
 * マーカー一覧:
 *   ```lms:lesson-complete    → LessonCompleteButton（完了ボタン）
 *   ```lms:progress           → ProgressIndicator（進捗バー）
 *   ```yaml:quiz              → QuizRenderer（クイズUI）
 *
 * コードブロックの中身にcourseIdを記述する:
 *   ```lms:lesson-complete
 *   courseId: intro
 *   ```
 */

import { createRoot } from 'react-dom/client';
import { getCurrentUserId } from './src/api';
import { LessonCompleteButton } from './src/LessonCompleteButton';
import { ProgressIndicator } from './src/ProgressIndicator';
import { QuizRenderer } from './src/QuizRenderer';
import { parseQuizYaml } from './src/yamlParser';

/** マウント済みのReactルートを追跡する */
const mountedRoots: Array<{ container: Element; root: ReturnType<typeof createRoot> }> = [];

/**
 * コードブロックのテキストからキーバリューを抽出する。
 * 例: "courseId: intro\n" → { courseId: "intro" }
 */
function parseBlockContent(text: string): Record<string, string> {
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
 * 指定の言語ラベルを持つコードブロック要素を全て検索する。
 * Growi v7 は <code class="language-{lang}"> でレンダリングする。
 */
function findCodeBlocks(wikiBody: Element, lang: string): Element[] {
  // class="language-lms:lesson-complete" 等
  const byClass = Array.from(wikiBody.querySelectorAll(`code[class*="language-${lang}"]`));
  // フォールバック: data-lang 属性
  const byData = Array.from(wikiBody.querySelectorAll(`[data-lang="${lang}"]`));
  // 重複除去
  const seen = new Set<Element>();
  return [...byClass, ...byData].filter((el) => {
    if (seen.has(el)) return false;
    seen.add(el);
    return true;
  });
}

/**
 * コードブロックを非表示にし、直後にReactコンポーネントをマウントするコンテナを挿入する。
 */
function replaceCodeBlock(codeEl: Element): HTMLDivElement | null {
  const preEl = codeEl.closest('pre') ?? codeEl.parentElement;
  if (!preEl) return null;

  (preEl as HTMLElement).style.display = 'none';

  const container = document.createElement('div');
  container.setAttribute('data-lms-plugin', 'true');
  preEl.parentNode?.insertBefore(container, preEl.nextSibling);

  return container;
}

/**
 * Reactコンポーネントをマウントし、追跡リストに登録する。
 */
function mount(container: HTMLDivElement, component: React.ReactNode): void {
  const root = createRoot(container);
  root.render(component);
  mountedRoots.push({ container, root });
}

/**
 * 前回マウントした全コンポーネントをアンマウントする。
 */
function unmountAll(): void {
  for (const { container, root } of mountedRoots) {
    root.unmount();
    container.remove();
  }
  mountedRoots.length = 0;
}

/**
 * ページ内のLMSマーカーを検索し、対応するコンポーネントを注入する。
 */
function scanAndMount(userId: string): void {
  const wikiBody = document.querySelector('.wiki-body-content');
  if (!wikiBody) return;

  unmountAll();

  const pagePath = window.location.pathname;

  // 1. lms:lesson-complete マーカー → 完了ボタン
  for (const el of findCodeBlocks(wikiBody, 'lms:lesson-complete')) {
    const props = parseBlockContent(el.textContent ?? '');
    if (!props.courseId) continue;

    const container = replaceCodeBlock(el);
    if (!container) continue;

    mount(
      container,
      <LessonCompleteButton courseId={props.courseId} pagePath={pagePath} userId={userId} />,
    );
  }

  // 2. lms:progress マーカー → 進捗バー
  for (const el of findCodeBlocks(wikiBody, 'lms:progress')) {
    const props = parseBlockContent(el.textContent ?? '');
    if (!props.courseId) continue;

    const container = replaceCodeBlock(el);
    if (!container) continue;

    mount(container, <ProgressIndicator courseId={props.courseId} userId={userId} />);
  }

  // 3. yaml:quiz マーカー → クイズUI
  for (const el of findCodeBlocks(wikiBody, 'yaml:quiz')) {
    const yamlText = el.textContent ?? '';
    // courseIdはquizマーカーのYAML内には書かないので、同じページ内のlesson-completeから取得するか、
    // ページ内の他のlmsマーカーから推定する。フォールバック: URLパスから推定
    const courseId = inferCourseId(wikiBody) ?? 'unknown';
    const quizData = parseQuizYaml(yamlText, courseId);

    if (!quizData) {
      console.warn('[growi-plugin-lms] yaml:quiz のパースに失敗しました');
      continue;
    }

    const container = replaceCodeBlock(el);
    if (!container) continue;

    mount(container, <QuizRenderer quizData={quizData} />);
  }
}

/**
 * ページ内の他のLMSマーカーからcourseIdを推定する。
 * 見つからない場合はURLパスから推定を試みる。
 */
function inferCourseId(wikiBody: Element): string | null {
  // 同一ページ内の lms:lesson-complete や lms:progress から取得
  for (const lang of ['lms:lesson-complete', 'lms:progress']) {
    for (const el of findCodeBlocks(wikiBody, lang)) {
      const props = parseBlockContent(el.textContent ?? '');
      if (props.courseId) return props.courseId;
    }
  }
  return null;
}

// ---- ページ遷移監視 ----

function watchPageChanges(userId: string): void {
  let lastPath = window.location.pathname;

  function onNavigate() {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      setTimeout(() => scanAndMount(userId), 500);
    }
  }

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = (...args) => { originalPushState(...args); onNavigate(); };
  history.replaceState = (...args) => { originalReplaceState(...args); onNavigate(); };
  window.addEventListener('popstate', onNavigate);

  // MutationObserverでGrowiの非同期レンダリング完了を検知
  const observer = new MutationObserver(() => {
    // マーカーが存在するのにマウント済みコンポーネントがない場合のみ再スキャン
    const wikiBody = document.querySelector('.wiki-body-content');
    if (!wikiBody) return;

    const hasMarkers =
      wikiBody.querySelector('code[class*="language-lms:"]') !== null ||
      wikiBody.querySelector('[data-lang^="lms:"]') !== null ||
      wikiBody.querySelector('code[class*="language-yaml:quiz"]') !== null;

    const hasMounts = wikiBody.querySelector('[data-lms-plugin]') !== null;

    if (hasMarkers && !hasMounts) {
      scanAndMount(userId);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ---- エントリーポイント ----

const activate = (): void => {
  console.log('[growi-plugin-lms] activate called');

  getCurrentUserId()
    .then((userId) => {
      if (!userId) {
        console.warn('[growi-plugin-lms] userId not found, plugin disabled');
        return;
      }

      console.log('[growi-plugin-lms] userId:', userId);
      scanAndMount(userId);
      watchPageChanges(userId);
    })
    .catch((err) => {
      console.warn('[growi-plugin-lms] activate failed:', err);
    });
};

export default { activate };
