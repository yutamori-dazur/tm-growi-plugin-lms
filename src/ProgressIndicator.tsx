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

// カラーパレット定数（復職名人Webサイトに合わせる）
const COLOR = {
  mainGreen: '#1a661e',
  barBg: '#e0e0e0',
  text: '#333',
  textMuted: '#888',
  border: 'hsla(0,0%,78%,.5)',
  white: '#fff',
  bg: '#faf5f0',
  fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
};

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
    backgroundColor: COLOR.white,
    border: `1px solid ${COLOR.border}`,
    fontFamily: COLOR.fontFamily,
  };

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: COLOR.text,
  };

  const trackStyle: React.CSSProperties = {
    width: '100%',
    height: '10px',
    borderRadius: '5px',
    backgroundColor: COLOR.barBg,
    overflow: 'hidden',
  };

  const { completedCount, totalCount } = progress;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = totalCount > 0 && completedCount >= totalCount;

  const fillStyle: React.CSSProperties = {
    height: '100%',
    width: `${percent}%`,
    borderRadius: '5px',
    backgroundColor: COLOR.mainGreen, // 完了・進行中ともに緑で統一
    transition: 'width 0.4s ease',
  };

  const percentStyle: React.CSSProperties = {
    marginTop: '0.4rem',
    fontSize: '0.8125rem',
    color: COLOR.textMuted,
    textAlign: 'right' as const,
  };

  // ---- レンダリング ----

  if (loadStatus === 'loading') {
    return (
      <div style={containerStyle}>
        <div style={{ ...labelStyle, color: COLOR.textMuted }}>進捗を読み込み中...</div>
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
            <span style={{ color: COLOR.mainGreen, marginLeft: '0.25rem' }}>全レッスン完了！</span>
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
      stroke="#1a661e"
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
      stroke="#1a661e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
