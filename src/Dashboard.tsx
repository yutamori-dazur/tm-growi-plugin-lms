/**
 * ダッシュボードコンポーネント — Growiページ内に埋め込むコース進捗一覧。
 */

import { useEffect, useState } from 'react';
import type { CourseDashboardItem, DashboardResponse } from './api';
import { getDashboardData } from './api';

/** コースIDからGrowiページパスへのマッピング */
const COURSE_PATH_MAP: Record<string, string> = {
  intro: '/07_e-ラーニング/ビギナークラス',
  'forms-mastery': '/07_e-ラーニング/手順と様式習得コース',
};

// カラーパレット定数（復職名人Webサイトに合わせる）
const COLOR = {
  mainGreen: '#1a661e',
  mainGreenLight: 'rgba(33, 128, 38, 0.05)',
  accentRed: '#e44141',
  accentBlue: '#1176d4',
  text: '#333',
  textMuted: '#888',
  border: 'hsla(0,0%,78%,.5)',
  white: '#fff',
  bg: '#faf5f0',
  barBg: '#e0e0e0',
  fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
};

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData(userId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <div style={S.container}><p style={S.muted}>読み込み中...</p></div>;
  }
  if (error) {
    return <div style={S.container}><p style={S.error}>エラー: {error}</p></div>;
  }
  if (!data || data.courses.length === 0) {
    return <div style={S.container}><p style={S.muted}>受講可能なコースがありません。</p></div>;
  }

  return (
    <div style={S.container}>
      <div style={S.grid}>
        {data.courses.map((course) => (
          <CourseCard key={course.courseId} course={course} />
        ))}
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: CourseDashboardItem }) {
  const percent = Math.round(course.progressPercent);
  const growiPath = COURSE_PATH_MAP[course.courseId];

  // 進捗バーは常にメイン緑で統一
  const barColor = COLOR.mainGreen;

  const cardContent = (
    <>
      {/* 修了バッジ */}
      {course.completed && (
        <div style={S.badge}>修了</div>
      )}

      <h3 style={S.cardTitle}>{course.title}</h3>

      {/* 進捗バー */}
      <div style={S.progressLabel}>
        {course.completedLessons} / {course.totalLessons} レッスン完了
      </div>
      <div style={S.barBg}>
        <div style={{ ...S.barFill, width: `${percent}%`, backgroundColor: barColor }} />
      </div>
      <div style={S.percent}>{percent}%</div>

      {/* クイズ結果 */}
      {course.quiz && course.quiz.attempted && (
        <div style={{
          ...S.quizResult,
          color: course.quiz.passed ? COLOR.mainGreen : COLOR.accentRed,
        }}>
          クイズ: {course.quiz.passed ? '合格' : '不合格'}
          {course.quiz.score !== null && ` (${course.quiz.score}点)`}
        </div>
      )}

      {/* 修了日 */}
      {course.completed && course.completedAt && (
        <div style={S.completedAt}>
          修了日: {new Date(course.completedAt).toLocaleDateString('ja-JP')}
        </div>
      )}
    </>
  );

  // カード全体をクリック可能にする
  if (growiPath) {
    return (
      <a href={growiPath} style={S.cardLink}>
        <div style={S.card}>{cardContent}</div>
      </a>
    );
  }
  return <div style={S.card}>{cardContent}</div>;
}

const S: Record<string, React.CSSProperties> = {
  container: {
    margin: '16px 0',
    fontFamily: COLOR.fontFamily,
    color: COLOR.text,
  },
  muted: {
    color: COLOR.textMuted,
  },
  error: {
    color: COLOR.accentRed,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  cardLink: {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
  } as React.CSSProperties,
  card: {
    position: 'relative',
    padding: '20px',
    border: `1px solid ${COLOR.border}`,
    borderRadius: '8px',
    backgroundColor: COLOR.white,
    fontFamily: COLOR.fontFamily,
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '2px 10px',
    borderRadius: '12px',
    backgroundColor: COLOR.mainGreen,
    color: COLOR.white,
    fontSize: '12px',
    fontWeight: 'bold',
  },
  cardTitle: {
    margin: '0 0 12px',
    fontSize: '16px',
    color: COLOR.text,
    fontWeight: 700,
  },
  progressLabel: {
    fontSize: '13px',
    color: COLOR.textMuted,
    marginBottom: '4px',
  },
  barBg: {
    height: '8px',
    backgroundColor: COLOR.barBg,
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s',
  },
  percent: {
    fontSize: '12px',
    color: COLOR.textMuted,
    textAlign: 'right',
    marginTop: '2px',
  },
  quizResult: {
    fontSize: '13px',
    marginTop: '8px',
    fontWeight: 'bold',
  },
  completedAt: {
    fontSize: '12px',
    color: COLOR.textMuted,
    marginTop: '4px',
  },
};
