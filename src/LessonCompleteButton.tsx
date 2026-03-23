/**
 * LessonCompleteButton — レッスン完了ボタンコンポーネント。
 * レッスンページ下部に挿入され、受講者がレッスンを完了したことを記録する。
 */

import { useEffect, useState } from 'react';
import { completeLesson, getLessonStatus } from './api';

interface Props {
  courseId: string;
  pagePath: string;
  userId: string;
}

type Status = 'loading' | 'incomplete' | 'submitting' | 'completed' | 'error';

export function LessonCompleteButton({ courseId, pagePath, userId }: Props) {
  const [status, setStatus] = useState<Status>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // マウント時に完了済みかどうかを確認する
  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const data = await getLessonStatus(userId, courseId);
        if (cancelled) return;

        // 該当コースの該当レッスンが完了済みかどうかを確認する
        const course = data.courses.find((c) => c.courseId === courseId);
        const lesson = course?.lessons.find((l) => l.pagePath === pagePath);
        setStatus(lesson?.completed ? 'completed' : 'incomplete');
      } catch {
        if (!cancelled) {
          // ステータス取得失敗時はデフォルトで未完了扱いにする
          // エラーを表示すると受講体験を損なうため、黙って incomplete にフォールバック
          setStatus('incomplete');
        }
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [courseId, pagePath, userId]);

  const handleClick = async () => {
    setStatus('submitting');
    setErrorMessage('');
    try {
      await completeLesson(courseId, pagePath);
      setStatus('completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setErrorMessage(message);
      setStatus('error');
    }
  };

  // ---- スタイル定義（Tailwind不可のためinline styleを使用）----

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '2rem',
    marginBottom: '1rem',
    padding: '1.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.12)',
  };

  const baseButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, opacity 0.2s ease',
    lineHeight: 1.5,
  };

  const incompleteButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: '#3b82f6', // blue-500
    color: '#ffffff',
  };

  const completedButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: '#22c55e', // green-500
    color: '#ffffff',
    cursor: 'default',
    opacity: 0.85,
  };

  const submittingButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    backgroundColor: '#6b7280', // gray-500
    color: '#ffffff',
    cursor: 'not-allowed',
    opacity: 0.7,
  };

  const errorStyle: React.CSSProperties = {
    marginTop: '0.5rem',
    color: '#f87171', // red-400
    fontSize: '0.875rem',
  };

  // ---- レンダリング ----

  if (status === 'loading') {
    return (
      <div style={containerStyle}>
        <button style={submittingButtonStyle} disabled>
          <Spinner />
          確認中...
        </button>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div style={containerStyle}>
        <button style={completedButtonStyle} disabled>
          <CheckIcon />
          完了済み
        </button>
      </div>
    );
  }

  if (status === 'submitting') {
    return (
      <div style={containerStyle}>
        <button style={submittingButtonStyle} disabled>
          <Spinner />
          記録中...
        </button>
      </div>
    );
  }

  // incomplete または error
  return (
    <div style={{ ...containerStyle, flexDirection: 'column' }}>
      <button
        style={incompleteButtonStyle}
        onClick={handleClick}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#2563eb';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#3b82f6';
        }}
      >
        <SquareIcon />
        このレッスンを完了する
      </button>
      {status === 'error' && <p style={errorStyle}>{errorMessage}</p>}
    </div>
  );
}

// ---- アイコンコンポーネント ----

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SquareIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'lms-spin 1s linear infinite' }}
    >
      <style>{`@keyframes lms-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
