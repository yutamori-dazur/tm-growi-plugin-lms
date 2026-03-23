/**
 * ダッシュボードコンポーネント — Growiページ内に埋め込むコース進捗一覧。
 */

import { useEffect, useState } from 'react';
import type { CourseDashboardItem, DashboardResponse } from './api';
import { getDashboardData } from './api';

/** コースIDからGrowiページパスへのマッピング */
const COURSE_PATH_MAP: Record<string, string> = {
  intro: '/07_e-ラーニング/入門編',
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
  const barColor = percent >= 100 ? '#22c55e' : '#3b82f6';
  const growiPath = COURSE_PATH_MAP[course.courseId];

  return (
    <div style={S.card}>
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
          color: course.quiz.passed ? '#22c55e' : '#f97316',
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

      {/* リンク */}
      {growiPath && (
        <a href={growiPath} style={S.link}>コースページへ →</a>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  container: {
    margin: '16px 0',
  },
  muted: {
    color: '#888',
  },
  error: {
    color: '#ef4444',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  card: {
    position: 'relative',
    flex: '1 1 280px',
    maxWidth: '400px',
    padding: '20px',
    border: '1px solid #333',
    borderRadius: '8px',
    backgroundColor: '#1e1e2e',
  },
  badge: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '2px 10px',
    borderRadius: '12px',
    backgroundColor: '#22c55e',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  cardTitle: {
    margin: '0 0 12px',
    fontSize: '16px',
    color: '#e0e0e0',
  },
  progressLabel: {
    fontSize: '13px',
    color: '#aaa',
    marginBottom: '4px',
  },
  barBg: {
    height: '8px',
    backgroundColor: '#333',
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
    color: '#888',
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
    color: '#888',
    marginTop: '4px',
  },
  link: {
    display: 'inline-block',
    marginTop: '12px',
    color: '#60a5fa',
    textDecoration: 'none',
    fontSize: '13px',
  },
};
