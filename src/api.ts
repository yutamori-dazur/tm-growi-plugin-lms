/**
 * LMS API クライアント。
 * すべてのAPIリクエストはこのモジュールに集約する。
 * コンポーネントから直接 fetch しない。
 */

const API_BASE = '/api/lms';

// ---- 型定義 ----

export interface LessonStatusItem {
  pagePath: string;
  title: string;
  completed: boolean;
  completedAt: string | null;
}

export interface CourseStatusItem {
  courseId: string;
  title: string;
  lessons: LessonStatusItem[];
  completedCount: number;
  totalCount: number;
}

export interface LessonStatusResponse {
  userId: string;
  courses: CourseStatusItem[];
}

export interface LessonCompleteResponse {
  success: boolean;
  completedAt: string;
}

export interface WhoAmIResponse {
  userId: string;
}

// ---- API関数 ----

/**
 * 現在のセッションからuserIdを取得する。
 * ヘルスチェックエンドポイントはuserIdを返さないため、
 * レッスン完了APIを呼ばずにuserIdだけ取得する専用エンドポイントとして
 * /api/lms/auth/me を使う。未実装の場合はフォールバックとして
 * /api/lms/health を呼んで接続確認だけを行う。
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data: WhoAmIResponse = await res.json();
    return data.userId ?? null;
  } catch {
    return null;
  }
}

/**
 * レッスン完了を記録する。
 * 既に完了済みの場合も success: true を返す（API側でupsert）。
 */
export async function completeLesson(
  courseId: string,
  pagePath: string,
): Promise<LessonCompleteResponse> {
  const res = await fetch(`${API_BASE}/lessons/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // connect.sid Cookie を送信するために必須
    body: JSON.stringify({ courseId, pagePath }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

/**
 * ユーザーのレッスン完了状況を取得する。
 * courseId を指定した場合はそのコースのみ返す。
 */
export async function getLessonStatus(
  userId: string,
  courseId?: string,
): Promise<LessonStatusResponse> {
  const params = courseId ? `?courseId=${encodeURIComponent(courseId)}` : '';
  const res = await fetch(`${API_BASE}/lessons/status/${encodeURIComponent(userId)}${params}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

// ---- クイズ関連型定義 ----

export interface QuizAnswerResult {
  questionIndex: number;
  selected: number[];
  correct: boolean;
}

export interface QuizSubmitResponse {
  score: number;
  maxScore: number;
  passed: boolean;
  passingScore: number;
  answers: QuizAnswerResult[];
  attemptedAt: string;
}

// ---- クイズ関連API関数 ----

/**
 * クイズ回答を送信して採点結果を取得する。
 * 採点はサーバーサイドで行うため、正解データはフロントエンドに返さない。
 */
// ---- ダッシュボード関連型定義 ----

export interface QuizProgressSummary {
  attempted: boolean;
  score: number | null;
  passed: boolean | null;
}

export interface CourseDashboardItem {
  courseId: string;
  title: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  quiz: QuizProgressSummary | null;
  completed: boolean;
  completedAt: string | null;
}

export interface DashboardResponse {
  userId: string;
  courses: CourseDashboardItem[];
}

/**
 * ダッシュボード用データを取得する。
 */
export async function getDashboardData(userId: string): Promise<DashboardResponse> {
  const res = await fetch(`${API_BASE}/dashboard/${encodeURIComponent(userId)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}

export async function submitQuiz(
  quizId: string,
  courseId: string,
  answers: Array<{ questionIndex: number; selected: number[] }>,
): Promise<QuizSubmitResponse> {
  const res = await fetch(`${API_BASE}/quizzes/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // connect.sid Cookie を送信するために必須
    body: JSON.stringify({ quizId, courseId, answers }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API error ${res.status}: ${detail}`);
  }
  return res.json();
}
