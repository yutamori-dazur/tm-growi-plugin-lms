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

// カラーパレット定数（復職名人Webサイトに合わせる）
const COLOR = {
  mainGreen: '#1a661e',
  mainGreenDark: '#145218',
  mainGreenLight: 'rgba(33, 128, 38, 0.05)',
  accentRed: '#e44141',
  accentYellow: '#d97706',
  text: '#333',
  textMuted: '#888',
  textSubtle: '#666',
  border: 'hsla(0,0%,78%,.5)',
  white: '#fff',
  bg: '#faf5f0',
  barBg: '#e0e0e0',
  tableBg: '#fff',
  tableHeaderBg: '#faf5f0',
  sortActiveColor: '#1a661e',
  fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
};

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
          onMouseEnter={(e) => {
            if (downloadingCsv !== '__all__') {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.mainGreenDark;
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.mainGreen;
          }}
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
                <td colSpan={5} style={{ ...S.td, color: COLOR.textMuted, textAlign: 'center' }}>
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
  const accentColor = rate > 60 ? COLOR.mainGreen : rate > 30 ? COLOR.accentYellow : COLOR.accentRed;

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
      style={{
        ...S.th,
        cursor: 'pointer',
        userSelect: 'none',
        color: isActive ? COLOR.sortActiveColor : COLOR.text,
      }}
      onClick={() => onClick(sortKey)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLTableCellElement).style.color = COLOR.sortActiveColor;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableCellElement).style.color = isActive ? COLOR.sortActiveColor : COLOR.text;
      }}
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

  return (
    <tr style={S.tr}>
      <td style={S.td}>
        <div style={{ fontWeight: 'bold', color: COLOR.text }}>{row.name || row.username}</div>
        <div style={{ fontSize: '11px', color: COLOR.textMuted }}>{row.username}</div>
      </td>
      <td style={{ ...S.td, color: COLOR.textSubtle }}>{row.courseTitle}</td>
      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...S.barBg, width: '80px', flexShrink: 0 }}>
            <div style={{ ...S.barFill, width: `${percent}%`, backgroundColor: COLOR.mainGreen }} />
          </div>
          <span style={{ fontSize: '12px', color: COLOR.textMuted, minWidth: '36px' }}>{percent}%</span>
        </div>
      </td>
      <td style={{ ...S.td, color: COLOR.textSubtle }}>
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
    fontFamily: COLOR.fontFamily,
    color: COLOR.text,
  },
  heading: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0 0 20px',
    color: COLOR.text,
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: COLOR.textSubtle,
    margin: '20px 0 10px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  muted: {
    color: COLOR.textMuted,
  },
  error: {
    color: COLOR.accentRed,
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
    backgroundColor: COLOR.white,
    border: `1px solid ${COLOR.border}`,
    borderTop: `3px solid ${COLOR.mainGreen}`, // borderTopColor はインラインで上書き
    borderRadius: '8px',
  },
  summaryTitle: {
    margin: '0 0 12px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: COLOR.text,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    fontSize: '13px',
  },
  summaryLabel: {
    color: COLOR.textMuted,
  },
  summaryValue: {
    color: COLOR.text,
  },
  // CSVボタン
  csvRow: {
    margin: '16px 0',
  },
  csvButton: {
    padding: '8px 20px',
    backgroundColor: COLOR.mainGreen,
    color: COLOR.white,
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontFamily: COLOR.fontFamily,
    transition: 'background-color 0.2s ease',
  },
  csvButtonSmall: {
    padding: '4px 12px',
    backgroundColor: COLOR.mainGreen,
    color: COLOR.white,
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: COLOR.fontFamily,
  },
  // テーブル
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
    backgroundColor: COLOR.tableBg,
  },
  th: {
    padding: '10px 12px',
    backgroundColor: COLOR.tableHeaderBg,
    color: COLOR.text,
    fontWeight: 'bold',
    textAlign: 'left',
    borderBottom: `2px solid ${COLOR.border}`,
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease',
  },
  tr: {
    borderBottom: `1px solid ${COLOR.border}`,
  },
  td: {
    padding: '10px 12px',
    verticalAlign: 'middle',
    color: COLOR.text,
  },
  // 進捗バー
  barBg: {
    height: '6px',
    backgroundColor: COLOR.barBg,
    borderRadius: '3px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
};
