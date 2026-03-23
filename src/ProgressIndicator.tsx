/**
 * ProgressIndicator — コーストップページ（index）に表示する進捗バーコンポーネント。
 * 受講者のレッスン完了状況をビジュアルで示す。
 */

import { useEffect, useState } from 'react';
import { getLessonStatus } from './api';

interface Props {
  courseId: string;
  userId: string;
}

interface ProgressState {
  completedCount: number;
  totalCount: number;
}

type Status = 'loading' | 'loaded' | 'error';

export function ProgressIndicator({ courseId, userId }: Props) {
  const [loadStatus, setLoadStatus] = useState<Status>('loading');
  const [progress, setProgress] = useState<ProgressState>({ completedCount: 0, totalCount: 0 });

  useEffect(() => {
    let cancelled = false;

    async function fetchProgress() {
      try {
        const data = await getLessonStatus(userId, courseId);
        if (cancelled) return;

        const course = data.courses.find((c) => c.courseId === courseId);
        if (course) {
          setProgress({
            completedCount: course.completedCount,
            totalCount: course.totalCount,
          });
        }
        setLoadStatus('loaded');
      } catch {
        if (!cancelled) {
          setLoadStatus('error');
        }
      }
    }

    fetchProgress();
    return () => {
      cancelled = true;
    };
  }, [courseId, userId]);

  // ---- スタイル定義（Tailwind不可のためinline styleを使用）----

  const containerStyle: React.CSSProperties = {
    margin: '1.5rem 0',
    padding: '1.25rem 1.5rem',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: '#e2e8f0',
  };

  const trackStyle: React.CSSProperties = {
    width: '100%',
    height: '10px',
    borderRadius: '5px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    overflow: 'hidden',
  };

  const { completedCount, totalCount } = progress;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = totalCount > 0 && completedCount >= totalCount;

  const fillStyle: React.CSSProperties = {
    height: '100%',
    width: `${percent}%`,
    borderRadius: '5px',
    backgroundColor: isComplete ? '#22c55e' : '#3b82f6', // 完了: 緑 / 進行中: 青
    transition: 'width 0.4s ease',
  };

  const percentStyle: React.CSSProperties = {
    marginTop: '0.4rem',
    fontSize: '0.8125rem',
    color: '#94a3b8',
    textAlign: 'right' as const,
  };

  // ---- レンダリング ----

  if (loadStatus === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={{ ...labelStyle, color: '#94a3b8' }}>進捗を読み込み中...</div>
        <div style={trackStyle}>
          <div style={{ ...fillStyle, width: '0%' }} />
        </div>
      </div>
    );
  }

  if (loadStatus === 'error') {
    // 進捗取得失敗時はコンポーネントを非表示にする（受講体験を損なわない）
    return null;
  }

  return (
    <div style={containerStyle}>
      <div style={labelStyle}>
        {isComplete ? (
          <>
            <CheckCircleIcon />
            <span>
              {completedCount} / {totalCount} レッスン完了
            </span>
            <span style={{ color: '#22c55e', marginLeft: '0.25rem' }}>全レッスン完了！</span>
          </>
        ) : (
          <>
            <BookOpenIcon />
            <span>
              {completedCount} / {totalCount} レッスン完了
            </span>
          </>
        )}
      </div>
      <div style={trackStyle}>
        <div style={fillStyle} />
      </div>
      <div style={percentStyle}>{percent}%</div>
    </div>
  );
}

// ---- アイコンコンポーネント ----

function CheckCircleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22c55e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function BookOpenIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
