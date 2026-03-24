/**
 * QuizRenderer — クイズUIコンポーネント。
 *
 * Growiページ内の ```yaml:quiz コードブロックから取得したクイズデータを
 * レンダリングし、回答送信・採点結果表示を担う。
 *
 * 採点はサーバーサイドで行うため、正解データはフロントエンドに一切保持しない。
 */

import { useState } from 'react';
import { submitQuiz, QuizSubmitResponse, QuizAnswerResult } from './api';
import { QuizData } from './yamlParser';

interface QuizRendererProps {
  quizData: QuizData;
}

type QuizPhase = 'answering' | 'submitting' | 'result' | 'error';

// カラーパレット定数（復職名人Webサイトに合わせる）
const COLOR = {
  mainGreen: '#1a661e',
  mainGreenDark: '#145218',
  mainGreenLight: 'rgba(33, 128, 38, 0.05)',
  mainGreenText: '#1a661e',
  gray: '#6b7280',
  grayDisabled: '#9ca3af',
  text: '#333',
  textMuted: '#888',
  border: 'hsla(0,0%,78%,.5)',
  white: '#fff',
  bg: '#faf5f0',
  accentRed: '#e44141',
  accentRedBg: '#fff2f0',
  accentRedBorder: 'rgba(228, 65, 65, 0.4)',
  accentBlue: '#3d79d5',
  accentBlueBg: '#f3f8fd',
  passedBannerBg: '#1a661e',
  correctText: '#1a661e',
  fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
};

// ---- モジュールレベルの静的スタイル定数 ----
// レンダリングのたびに新しいオブジェクトが生成されないようにモジュールスコープで定義する。

const S = {
  container: {
    marginTop: '2rem',
    marginBottom: '2rem',
    padding: '1.5rem',
    borderTop: `1px solid ${COLOR.border}`,
    fontFamily: COLOR.fontFamily,
    color: COLOR.text,
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
    whiteSpace: 'normal' as const,
    overflowWrap: 'break-word' as const,
    wordBreak: 'break-word' as const,
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    marginBottom: '1.5rem',
    color: COLOR.text,
  },
  questionBlock: {
    marginBottom: '1.75rem',
    padding: '1rem 1.25rem',
    border: `1px solid ${COLOR.border}`,
    borderRadius: '8px',
    backgroundColor: COLOR.white,
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
  },
  questionLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: COLOR.mainGreen,
    marginBottom: '0.4rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  questionText: {
    fontSize: '1rem',
    fontWeight: 500,
    marginBottom: '0.75rem',
    lineHeight: 1.6,
    color: COLOR.text,
    // 折り返し設定: 長い問題文がはみ出さないよう強制折り返しする
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    whiteSpace: 'normal' as const,
    maxWidth: '100%',
  },
  multipleNote: {
    fontSize: '0.75rem',
    color: COLOR.textMuted,
    marginBottom: '0.5rem',
  },
  optionLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.5rem 0.6rem',
    cursor: 'pointer',
    lineHeight: 1.5,
    fontSize: '0.95rem',
    borderRadius: '4px',
    transition: 'background-color 0.15s ease',
    // 選択肢テキストも折り返しを保証する
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
    whiteSpace: 'normal' as const,
  },
  inputControl: { marginTop: '3px', flexShrink: 0 },
  centerRow: { display: 'flex', justifyContent: 'center' },
  submitButtonBase: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    color: COLOR.white,
    transition: 'background-color 0.2s ease',
    marginTop: '0.5rem',
    fontFamily: COLOR.fontFamily,
  },
  submittingButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: 'none',
    color: COLOR.white,
    transition: 'background-color 0.2s ease',
    marginTop: '0.5rem',
    cursor: 'not-allowed' as const,
    backgroundColor: COLOR.gray,
    opacity: 0.7,
    fontFamily: COLOR.fontFamily,
  },
  passedBanner: {
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: COLOR.passedBannerBg,
    color: COLOR.white,
    fontWeight: 700,
    fontSize: '1.125rem',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  failedBanner: {
    padding: '1rem 1.25rem',
    borderRadius: '8px',
    backgroundColor: COLOR.accentRedBg,
    border: `1px solid ${COLOR.accentRedBorder}`,
    color: COLOR.accentRed,
    fontWeight: 700,
    fontSize: '1.125rem',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  retryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.65rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: `1px solid ${COLOR.accentRed}`,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: COLOR.accentRed,
    transition: 'background-color 0.2s ease',
    marginTop: '1rem',
    fontFamily: COLOR.fontFamily,
  },
  error: {
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    backgroundColor: COLOR.accentRedBg,
    border: `1px solid ${COLOR.accentRedBorder}`,
    color: COLOR.accentRed,
    fontSize: '0.875rem',
  },
  answerDetail: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    marginTop: '0.35rem',
    color: COLOR.text,
    // 回答テキストも折り返しを保証する
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  correctAnswerText: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    marginTop: '0.25rem',
    color: COLOR.correctText,
    fontWeight: 600,
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
  explanationBox: {
    marginTop: '0.75rem',
    padding: '0.6rem 0.85rem',
    borderRadius: '6px',
    backgroundColor: COLOR.accentBlueBg,
    borderLeft: `3px solid ${COLOR.accentBlue}`,
    fontSize: '0.875rem',
    lineHeight: 1.6,
    color: COLOR.text,
    wordWrap: 'break-word' as const,
    overflowWrap: 'break-word' as const,
  },
} satisfies Record<string, React.CSSProperties>;

export function QuizRenderer({ quizData }: QuizRendererProps) {
  const { title, quizId, courseId, passingScore, questions } = quizData;

  // 各問の選択状態: questionIndex → 選択した選択肢インデックスの配列
  const [selections, setSelections] = useState<Map<number, number[]>>(new Map());
  const [phase, setPhase] = useState<QuizPhase>('answering');
  const [result, setResult] = useState<QuizSubmitResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 全問に1つ以上の回答が選択されているか判定する（送信ボタンの活性制御）
  const allAnswered = questions.every((_, idx) => {
    const sel = selections.get(idx);
    return sel && sel.length > 0;
  });

  const handleSingleChange = (questionIndex: number, optionIndex: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(questionIndex, [optionIndex]);
      return next;
    });
  };

  const handleMultipleChange = (questionIndex: number, optionIndex: number, checked: boolean) => {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(questionIndex) ?? [];
      if (checked) {
        next.set(questionIndex, [...current, optionIndex].sort((a, b) => a - b));
      } else {
        next.set(
          questionIndex,
          current.filter((i) => i !== optionIndex),
        );
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setPhase('submitting');
    setErrorMessage('');

    const answers = questions.map((_, idx) => ({
      questionIndex: idx,
      selected: selections.get(idx) ?? [],
    }));

    try {
      const res = await submitQuiz(quizId, courseId, answers);
      setResult(res);
      setPhase('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      setErrorMessage(message);
      setPhase('error');
    }
  };

  const handleRetry = () => {
    setSelections(new Map());
    setResult(null);
    setErrorMessage('');
    setPhase('answering');
  };

  // submitButtonStyle は allAnswered に依存するため render 内で算出する
  const submitButtonStyle: React.CSSProperties = {
    ...S.submitButtonBase,
    cursor: allAnswered ? 'pointer' : 'not-allowed',
    backgroundColor: allAnswered ? COLOR.mainGreen : COLOR.gray,
    opacity: allAnswered ? 1 : 0.6,
  };

  // ---- フェーズ別レンダリング ----

  if (phase === 'answering' || phase === 'submitting') {
    const isSubmitting = phase === 'submitting';

    return (
      <div style={S.container}>
        <h3 style={S.title}>{title}</h3>

        {questions.map((q, qIdx) => (
          <div key={qIdx} style={S.questionBlock}>
            <div style={S.questionLabel}>Q{qIdx + 1}</div>
            <div style={S.questionText}>{q.text}</div>

            {q.type === 'multiple' && (
              <div style={S.multipleNote}>※ 複数選択可</div>
            )}

            <div>
              {q.options.map((option, oIdx) => {
                const currentSel = selections.get(qIdx) ?? [];
                const isSelected = currentSel.includes(oIdx);

                if (q.type === 'single') {
                  return (
                    <label
                      key={oIdx}
                      style={{
                        ...S.optionLabel,
                        backgroundColor: isSelected ? COLOR.mainGreenLight : 'transparent',
                      }}
                    >
                      <input
                        type="radio"
                        name={`q${qIdx}`}
                        value={oIdx}
                        checked={isSelected}
                        onChange={() => !isSubmitting && handleSingleChange(qIdx, oIdx)}
                        disabled={isSubmitting}
                        style={S.inputControl}
                      />
                      {option}
                    </label>
                  );
                } else {
                  return (
                    <label
                      key={oIdx}
                      style={{
                        ...S.optionLabel,
                        backgroundColor: isSelected ? COLOR.mainGreenLight : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        value={oIdx}
                        checked={isSelected}
                        onChange={(e) =>
                          !isSubmitting && handleMultipleChange(qIdx, oIdx, e.target.checked)
                        }
                        disabled={isSubmitting}
                        style={S.inputControl}
                      />
                      {option}
                    </label>
                  );
                }
              })}
            </div>
          </div>
        ))}

        <div style={S.centerRow}>
          {isSubmitting ? (
            <button style={S.submittingButton} disabled>
              <Spinner />
              採点中...
            </button>
          ) : (
            <button
              style={submitButtonStyle}
              disabled={!allAnswered}
              onClick={handleSubmit}
              onMouseEnter={(e) => {
                if (allAnswered) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.mainGreenDark;
                }
              }}
              onMouseLeave={(e) => {
                if (allAnswered) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.mainGreen;
                }
              }}
            >
              回答を送信する
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={S.container}>
        <h3 style={S.title}>{title}</h3>
        <div style={S.error}>
          <strong>送信エラー:</strong> {errorMessage}
        </div>
        <div style={S.centerRow}>
          <button
            style={S.retryButton}
            onClick={handleRetry}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.accentRedBg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            もう一度挑戦する
          </button>
        </div>
      </div>
    );
  }

  // result フェーズ
  if (!result) return null;

  const scorePercent = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;

  return (
    <div style={S.container}>
      <h3 style={S.title}>{title} — 結果</h3>

      {result.passed ? (
        <div style={S.passedBanner}>
          合格！ スコア: {scorePercent}/100
        </div>
      ) : (
        <div style={S.failedBanner}>
          不合格 スコア: {scorePercent}/100（合格ライン: {passingScore}点）
        </div>
      )}

      {/* 各問の正誤フィードバック */}
      {questions.map((q, qIdx) => {
        const answerResult: QuizAnswerResult | undefined = result.answers.find(
          (a) => a.questionIndex === qIdx,
        );
        const isCorrect = answerResult?.correct ?? false;

        // 受講者が選択した選択肢テキストを生成する
        const selectedTexts = (answerResult?.selected ?? [])
          .map((i) => q.options[i])
          .filter(Boolean)
          .join('、');

        // 正解の選択肢テキストを生成する（APIが返す場合のみ表示）
        const correctTexts =
          answerResult?.correctAnswer != null
            ? answerResult.correctAnswer
                .map((i) => q.options[i])
                .filter(Boolean)
                .join('、')
            : null;

        // isCorrect に依存するため render 内で算出する
        const feedbackBlockStyle: React.CSSProperties = {
          ...S.questionBlock,
          borderColor: isCorrect ? 'rgba(26, 102, 30, 0.4)' : COLOR.accentRedBorder,
          backgroundColor: isCorrect ? 'rgba(26, 102, 30, 0.04)' : COLOR.accentRedBg,
        };
        const indicatorStyle: React.CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: isCorrect ? COLOR.mainGreenText : COLOR.accentRed,
          marginBottom: '0.4rem',
        };

        return (
          <div key={qIdx} style={feedbackBlockStyle}>
            <div style={S.questionLabel}>Q{qIdx + 1}</div>
            <div style={S.questionText}>{q.text}</div>
            <div style={indicatorStyle}>
              {isCorrect ? <CheckIcon /> : <CrossIcon />}
              {isCorrect ? '正解' : '不正解'}
            </div>
            {/* 受講者の回答を表示する */}
            {selectedTexts && (
              <div style={S.answerDetail}>あなたの回答: {selectedTexts}</div>
            )}
            {/* 不正解かつAPIが正解を返した場合のみ正解を表示する */}
            {!isCorrect && correctTexts && (
              <div style={S.correctAnswerText}>正解: {correctTexts}</div>
            )}
            {/* 解説テキストがある場合に表示する */}
            {answerResult?.explanation && (
              <div style={S.explanationBox}>
                <strong>[解説]</strong> {answerResult.explanation}
              </div>
            )}
          </div>
        );
      })}

      {/* 不合格の場合のみ再挑戦ボタンを表示 */}
      {!result.passed && (
        <div style={S.centerRow}>
          <button
            style={S.retryButton}
            onClick={handleRetry}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = COLOR.accentRedBg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            もう一度挑戦する
          </button>
        </div>
      )}
    </div>
  );
}

// ---- アイコンコンポーネント ----

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
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

function CrossIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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
