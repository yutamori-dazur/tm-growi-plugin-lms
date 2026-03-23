/**
 * growi-plugin-lms — クライアントエントリーポイント。
 *
 * Growi v7 のスクリプト型プラグインとして読み込まれ、
 * activate() が呼ばれたタイミングでDOMへのコンポーネント注入を開始する。
 *
 * SPA的なページ遷移（pushState）に対応するため、MutationObserver で
 * .wiki-body-content の変化を監視し、ページ切り替えのたびに再マウントする。
 */

import { createRoot } from 'react-dom/client';
import { getCurrentUserId } from './src/api';
import { LessonCompleteButton } from './src/LessonCompleteButton';
import { ProgressIndicator } from './src/ProgressIndicator';
import { QuizRenderer } from './src/QuizRenderer';
import { parseQuizYaml } from './src/yamlParser';

// ---- 定数 ----

/** LMSの対象パスプレフィックス */
const LMS_BASE_PATH = '/07_e-ラーニング/';

/**
 * コース名 → コースID のマッピング。
 * Phase 1 では定数として管理し、Phase 3以降でAPIから動的取得に移行予定。
 * キー: Growiページパスのコースディレクトリ名（日本語）
 * 値: lms.courses の courseId フィールド
 */
const COURSE_ID_MAP: Record<string, string> = {
  '入門編': 'intro',
  '実務編': 'practical',
  '上級編': 'advanced',
  'ケーススタディ編': 'case-study',
};

/** プラグインがマウントしたReactルートを追跡するためのWeakMap */
const mountedRoots = new WeakMap<Element, ReturnType<typeof createRoot>>();

/** 前回マウントしたコンテナ要素。ページ遷移時にアンマウントするために保持する */
let previousContainer: Element | null = null;

// ---- ユーティリティ ----

/**
 * 現在のページパスを取得する。
 * Growi は SPA のためURLは window.location.pathname で取得できる。
 */
function getCurrentPagePath(): string {
  return window.location.pathname;
}

/**
 * ページパスからコースIDとコース名を取得する。
 *
 * パス例: /07_e-ラーニング/入門編/lesson01
 * → { courseName: '入門編', courseId: 'intro', isIndex: false }
 *
 * パス例: /07_e-ラーニング/入門編/index
 * → { courseName: '入門編', courseId: 'intro', isIndex: true }
 */
function parseLmsPath(pagePath: string): {
  courseName: string;
  courseId: string;
  isIndex: boolean;
  isQuiz: boolean;
} | null {
  // LMSパスでなければ無視する
  if (!pagePath.startsWith(LMS_BASE_PATH)) return null;

  // /07_e-ラーニング/ を除いたパス部分を取得する
  const relativePath = pagePath.slice(LMS_BASE_PATH.length);
  const segments = relativePath.split('/').filter(Boolean);

  // セグメントが1つ以下 = コース一覧ページや案内ページ（注入不要）
  if (segments.length < 2) return null;

  const courseName = segments[0];
  const courseId = COURSE_ID_MAP[courseName];

  // マッピングにないコース名は現時点では対象外
  if (!courseId) return null;

  const pageSegment = segments[segments.length - 1];
  const isIndex = pageSegment === 'index';
  const isQuiz = pageSegment === 'quiz';

  return { courseName, courseId, isIndex, isQuiz };
}

// ---- コンポーネントマウント ----

/**
 * 現在のページに応じて適切なコンポーネントを .wiki-body-content へ注入する。
 * ページ遷移のたびに呼ばれるため、前回のコンテナをアンマウントしてから再作成する。
 */
async function mountComponents(userId: string): Promise<void> {
  const pagePath = getCurrentPagePath();
  const parsed = parseLmsPath(pagePath);

  // 前回のコンポーネントをアンマウントする（メモリリーク防止）
  if (previousContainer) {
    const prevRoot = mountedRoots.get(previousContainer);
    if (prevRoot) {
      prevRoot.unmount();
      mountedRoots.delete(previousContainer);
    }
    previousContainer.remove();
    previousContainer = null;
  }

  // LMS対象ページでなければ何もしない
  if (!parsed) return;

  const { courseId, isIndex, isQuiz } = parsed;

  // マウント先の .wiki-body-content を取得する
  const wikiBody = document.querySelector('.wiki-body-content');
  if (!wikiBody) return;

  if (isQuiz) {
    // クイズページ: yaml:quiz コードブロックを探してQuizRendererを注入する
    mountQuizRenderer(wikiBody, courseId);
    return;
  }

  // Reactのマウント先 div を作成して wiki-body-content 末尾に追加する
  const container = document.createElement('div');
  container.setAttribute('data-lms-plugin', isIndex ? 'progress' : 'lesson-complete');
  wikiBody.appendChild(container);

  previousContainer = container;
  const root = createRoot(container);
  mountedRoots.set(container, root);

  if (isIndex) {
    // コーストップページ: 進捗バーを表示する
    root.render(<ProgressIndicator courseId={courseId} userId={userId} />);
  } else {
    // レッスンページ: 完了ボタンを表示する
    root.render(
      <LessonCompleteButton courseId={courseId} pagePath={pagePath} userId={userId} />,
    );
  }
}

/**
 * クイズページ内の yaml:quiz コードブロックを検索し、QuizRenderer を注入する。
 *
 * Growi v7 はコードブロックを以下のいずれかの形式でレンダリングする:
 *   1. <code class="language-yaml:quiz">...</code>
 *   2. <div data-lang="yaml:quiz">...</div>  （バージョンによる）
 *
 * 見つかったコードブロックは非表示にし、直後に QuizRenderer をマウントする。
 * 複数の yaml:quiz ブロックが存在する場合は最初のものだけを対象とする。
 */
function mountQuizRenderer(wikiBody: Element, courseId: string): void {
  // "language-yaml:quiz" クラスを持つ code 要素を探す（Growi v7 の標準形式）
  let codeEl: Element | null = wikiBody.querySelector('code[class*="language-yaml:quiz"]');

  // フォールバック: data-lang 属性を持つ要素を探す
  if (!codeEl) {
    codeEl = wikiBody.querySelector('[data-lang="yaml:quiz"]');
  }

  if (!codeEl) {
    // yaml:quiz ブロックが見つからなければ何もしない
    return;
  }

  const yamlText = codeEl.textContent ?? '';
  const quizData = parseQuizYaml(yamlText, courseId);

  if (!quizData) {
    // YAMLパース失敗時はエラーをコンソールに出すだけでページ表示は壊さない
    console.warn('[growi-plugin-lms] yaml:quiz のパースに失敗しました', yamlText);
    return;
  }

  // コードブロック全体（pre要素）を非表示にする
  // pre > code の構造が想定されるが、直接の親が pre でない場合も考慮する
  const preEl = codeEl.closest('pre') ?? codeEl.parentElement;
  if (preEl) {
    (preEl as HTMLElement).style.display = 'none';
  }

  // QuizRenderer のマウント先コンテナを作成して挿入する
  const container = document.createElement('div');
  container.setAttribute('data-lms-plugin', 'quiz');

  // コードブロックの親要素の後に挿入する（preElが非表示になった直後）
  const insertTarget = preEl ?? codeEl;
  insertTarget.parentNode?.insertBefore(container, insertTarget.nextSibling);

  previousContainer = container;
  const root = createRoot(container);
  mountedRoots.set(container, root);

  root.render(<QuizRenderer quizData={quizData} />);
}

// ---- MutationObserver によるページ遷移検知 ----

/**
 * .wiki-body-content のDOM変化を監視して、ページ遷移時にコンポーネントを再マウントする。
 * Growi v7 は SPA のため、ページ遷移でも document は生き続ける。
 * title要素やbody直下の変化も監視することでナビゲーションを検知する。
 */
function watchPageChanges(userId: string): void {
  let lastPath = getCurrentPagePath();

  // history.pushState / replaceState をラップしてURLの変化を検知する
  // MutationObserver だけでは URL 変化を確実に捉えられないため両方使う
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  function onNavigate() {
    const currentPath = getCurrentPagePath();
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      // DOMの更新を待ってからマウントする
      // Growi がレンダリングを完了するまで短い遅延を設ける
      setTimeout(() => mountComponents(userId), 300);
    }
  }

  history.pushState = (...args) => {
    originalPushState(...args);
    onNavigate();
  };

  history.replaceState = (...args) => {
    originalReplaceState(...args);
    onNavigate();
  };

  window.addEventListener('popstate', onNavigate);

  // .wiki-body-content の変化を MutationObserver で監視する
  // Growi がページコンテンツを非同期でレンダリングするタイミングに対応するため
  const observer = new MutationObserver(() => {
    const currentPath = getCurrentPagePath();
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      mountComponents(userId);
    } else {
      // 同一ページ内で .wiki-body-content が更新された場合も再マウントする
      // （Growiがページを再レンダリングしたとき）
      mountComponents(userId);
    }
  });

  // body 全体を監視対象にして、wiki-body-content の出現も検知する
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

// ---- プラグインエントリーポイント ----

/**
 * Growi がプラグインをロードした後に呼び出す activate 関数。
 * ユーザーIDを取得し、ページ監視を開始する。
 */
const activate = (): void => {
  // ユーザーIDを取得してからページ監視を開始する
  // getUserIdに失敗した場合はプラグインを無効化する（未ログイン状態）
  getCurrentUserId()
    .then((userId) => {
      if (!userId) {
        // 未ログインの場合はLMSコンポーネントを表示しない
        return;
      }

      // 初回レンダリング（ページ読み込み時）
      mountComponents(userId);

      // 以降のSPAナビゲーションに対応する
      watchPageChanges(userId);
    })
    .catch((err) => {
      // activate 自体は例外を外に出さない（Growiのプラグインシステムへの影響を防ぐ）
      console.warn('[growi-plugin-lms] activate failed:', err);
    });
};

export default { activate };
