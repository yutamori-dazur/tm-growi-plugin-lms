/**
 * 管理者ダッシュボードコンポーネント — 全受講者の進捗・修了状況を一覧表示する。
 * 管理者権限のないユーザーがアクセスした場合は権限エラーメッセージを表示する。
 */

import { useEffect, useMemo, useState } from 'react';
import type { AdminOverviewResponse, CourseOverview } from './api';
import { downloadCsv, getAdminOverview } from './api';

type SortKey = 'username' | 'progressPercent' | 'quizScore';
type SortDir = 'asc' | 'desc';

interface FlatRow {
  userId: string;
  username: string;
  name: string;
  courseId: string;
  courseTitle: string;
  progressPercent: number;
  quizScore: number | null;
  completed: boolean;
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);

  // テーブルソート状態
  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // CSVダウンロード中フラグ（コースIDごとに管理）
  const [downloadingCsv, setDownloadingCsv] = useState<string | null>(null);

  useEffect(() => {
    getAdminOverview()
      .then(setData)
      .catch((e: Error) => {
        // 403エラーは管理者権限なしとして扱う
        if (e.message.includes('403')) {
          setIsForbidden(true);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // 受講者×コースのフラットな行リストを生成してソートする
  const sortedRows = useMemo<FlatRow[]>(() => {
    if (!data) return [];
    const rows: FlatRow[] = [];
    for (const user of data.users) {
      for (const cp of user.courses) {
        // コースタイトルをコース一覧から取得
        const courseInfo = data.courses.find((c) => c.courseId === cp.courseId);
        rows.push({
          userId: user.userId,
          username: user.username,
          name: user.name,
          courseId: cp.courseId,
          courseTitle: courseInfo?.title ?? cp.courseId,
          progressPercent: cp.progressPercent,
          quizScore: cp.quizScore,
          completed: cp.completed,
        });
      }
    }

    rows.sort((a, b) => {
      let diff = 0;
      if (sortKey === 'username') {
        diff = a.username.localeCompare(b.username, 'ja');
      } else if (sortKey === 'progressPercent') {
        diff = a.progressPercent - b.progressPercent;
      } else if (sortKey === 'quizScore') {
        // null は末尾に置く
        const aScore = a.quizScore ?? -1;
        const bScore = b.quizScore ?? -1;
        diff = aScore - bScore;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  async function handleDownloadCsv(courseId?: string) {
    const key = courseId ?? '__all__';
    setDownloadingCsv(key);
    try {
      await downloadCsv(courseId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`CSVダウンロードに失敗しました: ${msg}`);
    } finally {
      setDownloadingCsv(null);
    }
  }

  if (loading) {
    return (
      <div style={S.container}>
        <p style={S.muted}>読み込み中...</p>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div style={S.container}>
        <p style={S.error}>管理者権限が必要です。</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.container}>
        <p style={S.error}>エラー: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={S.container}>
      <h2 style={S.heading}>管理者ダッシュボード</h2>

      {/* コースサマリーカード */}
      <h3 style={S.sectionTitle}>コースサマリー</h3>
      <div style={S.cardGrid}>
        {data.courses.map((course) => (
          <CourseSummaryCard
            key={course.courseId}
            course={course}
            onDownload={() => handleDownloadCsv(course.courseId)}
            isDownloading={downloadingCsv === course.courseId}
          />
        ))}
      </div>

      {/* 全体CSVダウンロード */}
      <div style={S.csvRow}>
        <button
          style={{
            ...S.csvButton,
            opacity: downloadingCsv === '__all__' ? 0.6 : 1,
            cursor: downloadingCsv === '__all__' ? 'not-allowed' : 'pointer',
          }}
          onClick={() => handleDownloadCsv()}
          disabled={downloadingCsv === '__all__'}
        >
          {downloadingCsv === '__all__' ? 'ダウンロード中...' : '全体 CSV ダウンロード'}
        </button>
      </div>

      {/* 受講者一覧テーブル */}
      <h3 style={S.sectionTitle}>受講者一覧</h3>
      <div style={S.tableWrapper}>
        <table style={S.table}>
          <thead>
            <tr>
              <SortableHeader
                label="ユーザー"
                sortKey="username"
                current={sortKey}
                dir={sortDir}
                onClick={handleSortClick}
              />
              <th style={S.th}>コース</th>
              <SortableHeader
                label="進捗"
                sortKey="progressPercent"
                current={sortKey}
                dir={sortDir}
                onClick={handleSortClick}
              />
              <SortableHeader
                label="スコア"
                sortKey="quizScore"
                current={sortKey}
                dir={sortDir}
                onClick={handleSortClick}
              />
              <th style={S.th}>修了</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ ...S.td, color: '#888', textAlign: 'center' }}>
                  データがありません
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => <ProgressRow key={`${row.userId}-${row.courseId}`} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- 子コンポーネント ----

function CourseSummaryCard({
  course,
  onDownload,
  isDownloading,
}: {
  course: CourseOverview;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  const rate = Math.round(course.completionRate);
  // 修了率に応じてカードのアクセントカラーを変える（緑>60%, 黄>30%, 赤<=30%）
  const accentColor = rate > 60 ? '#22c55e' : rate > 30 ? '#eab308' : '#ef4444';

  return (
    <div style={{ ...S.summaryCard, borderTopColor: accentColor }}>
      <h4 style={S.summaryTitle}>{course.title}</h4>
      <div style={S.summaryRow}>
        <span style={S.summaryLabel}>受講者</span>
        <span style={S.summaryValue}>{course.totalEnrolled}名</span>
      </div>
      <div style={S.summaryRow}>
        <span style={S.summaryLabel}>修了者</span>
        <span style={S.summaryValue}>{course.totalCompleted}名</span>
      </div>
      <div style={S.summaryRow}>
        <span style={S.summaryLabel}>修了率</span>
        <span style={{ ...S.summaryValue, color: accentColor, fontWeight: 'bold' }}>{rate}%</span>
      </div>
      {course.averageQuizScore !== null && (
        <div style={S.summaryRow}>
          <span style={S.summaryLabel}>平均スコア</span>
          <span style={S.summaryValue}>{Math.round(course.averageQuizScore)}点</span>
        </div>
      )}
      <button
        style={{
          ...S.csvButtonSmall,
          marginTop: '12px',
          opacity: isDownloading ? 0.6 : 1,
          cursor: isDownloading ? 'not-allowed' : 'pointer',
        }}
        onClick={onDownload}
        disabled={isDownloading}
      >
        {isDownloading ? '...' : 'CSV'}
      </button>
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (key: SortKey) => void;
}) {
  const isActive = sortKey === current;
  const arrow = isActive ? (dir === 'asc' ? ' ▲' : ' ▼') : ' ↕';
  return (
    <th
      style={{ ...S.th, cursor: 'pointer', userSelect: 'none', color: isActive ? '#60a5fa' : '#ccc' }}
      onClick={() => onClick(sortKey)}
      // キーボード操作のためのa11y属性
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(sortKey); }}
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      <span style={{ fontSize: '10px', marginLeft: '2px' }}>{arrow}</span>
    </th>
  );
}

function ProgressRow({ row }: { row: FlatRow }) {
  const percent = Math.round(row.progressPercent);
  const barColor = percent >= 100 ? '#22c55e' : '#3b82f6';

  return (
    <tr style={S.tr}>
      <td style={S.td}>
        <div style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{row.name || row.username}</div>
        <div style={{ fontSize: '11px', color: '#888' }}>{row.username}</div>
      </td>
      <td style={{ ...S.td, color: '#ccc' }}>{row.courseTitle}</td>
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...S.barBg, width: '80px', flexShrink: 0 }}>
            <div style={{ ...S.barFill, width: `${percent}%`, backgroundColor: barColor }} />
          </div>
          <span style={{ fontSize: '12px', color: '#aaa', minWidth: '36px' }}>{percent}%</span>
        </div>
      </td>
      <td style={{ ...S.td, color: '#ccc' }}>
        {row.quizScore !== null ? `${row.quizScore}点` : '—'}
      </td>
      <td style={{ ...S.td, textAlign: 'center', fontSize: '16px' }}>
        {row.completed ? '✅' : ''}
      </td>
    </tr>
  );
}

// ---- スタイル ----

const S: Record<string, React.CSSProperties> = {
  container: {
    margin: '16px 0',
    fontFamily: 'sans-serif',
    color: '#e0e0e0',
  },
  heading: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 20px',
    color: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#aaa',
    margin: '20px 0 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  muted: {
    color: '#888',
  },
  error: {
    color: '#ef4444',
  },
  // コースサマリーカード
  cardGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
  },
  summaryCard: {
    flex: '1 1 200px',
    maxWidth: '280px',
    padding: '16px',
    backgroundColor: '#1e1e2e',
    border: '1px solid #333',
    borderTop: '3px solid #22c55e', // borderTopColor はインラインで上書き
    borderRadius: '8px',
  },
  summaryTitle: {
    margin: '0 0 12px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#e0e0e0',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    fontSize: '13px',
  },
  summaryLabel: {
    color: '#888',
  },
  summaryValue: {
    color: '#ccc',
  },
  // CSVボタン
  csvRow: {
    margin: '16px 0',
  },
  csvButton: {
    padding: '8px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  csvButtonSmall: {
    padding: '4px 12px',
    backgroundColor: '#374151',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  // テーブル
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '10px 12px',
    backgroundColor: '#12121e',
    color: '#ccc',
    fontWeight: 'bold',
    textAlign: 'left',
    borderBottom: '2px solid #333',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid #2a2a3e',
  },
  td: {
    padding: '10px 12px',
    verticalAlign: 'middle',
  },
  // 進捗バー
  barBg: {
    height: '6px',
    backgroundColor: '#333',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
};
