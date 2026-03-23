/**
 * 簡易YAMLパーサー — クイズ定義YAML専用。
 *
 * 完全なYAML仕様には対応しない。
 * クイズYAMLの限定的な構造（キーバリュー、リスト、ネスト）のみをパースする。
 *
 * 重要: answer フィールドはパース結果から除外する。
 * フロントエンドに正解データを露出しないためのセキュリティ要件。
 */

export interface QuizQuestion {
  type: 'single' | 'multiple';
  text: string;
  options: string[];
  // answer は意図的に含めない
}

export interface QuizData {
  title: string;
  quizId: string;
  courseId: string;
  passingScore: number;
  questions: QuizQuestion[];
}

/**
 * 文字列のクォートを除去する。
 * "value" や 'value' → value
 */
function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * インデントレベル（スペース数）を計算する。
 */
function indentLevel(line: string): number {
  let count = 0;
  for (const ch of line) {
    if (ch === ' ') count++;
    else break;
  }
  return count;
}

/**
 * クイズYAMLをパースして QuizData を返す。
 *
 * 対応フォーマット:
 * ```yaml
 * quiz:
 *   title: "タイトル"
 *   passingScore: 80
 *   questions:
 *     - type: single
 *       text: "問題文"
 *       options:
 *         - "選択肢A"
 *         - "選択肢B"
 *       answer: 0        ← パース後に除外する
 * ```
 *
 * @param yamlText - YAMLテキスト
 * @param courseId - コースID（quizId 生成に使用）
 * @returns パース結果。パース失敗時は null を返す
 */
export function parseQuizYaml(yamlText: string, courseId: string): QuizData | null {
  try {
    const lines = yamlText.split('\n');
    let title = 'クイズ';
    let passingScore = 80;
    let parsedCourseId: string | null = null;
    const rawQuestions: Array<{
      type: string;
      text: string;
      options: string[];
    }> = [];

    let i = 0;

    // "quiz:" ブロックの開始を探す
    while (i < lines.length && !lines[i].trim().startsWith('quiz:')) {
      i++;
    }
    if (i >= lines.length) return null;
    i++; // "quiz:" 行を読み飛ばす

    // quiz ブロック内のキーをパース（インデント2）
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // quiz ブロックを抜けた（インデントが0に戻った）
      if (indentLevel(line) === 0 && trimmed !== '') break;

      if (trimmed.startsWith('title:')) {
        title = stripQuotes(trimmed.slice('title:'.length).trim());
        i++;
      } else if (trimmed.startsWith('courseId:')) {
        parsedCourseId = stripQuotes(trimmed.slice('courseId:'.length).trim());
        i++;
      } else if (trimmed.startsWith('passingScore:')) {
        const val = parseInt(trimmed.slice('passingScore:'.length).trim(), 10);
        if (!isNaN(val)) passingScore = val;
        i++;
      } else if (trimmed.startsWith('questions:')) {
        i++; // "questions:" 行を読み飛ばす
        // questions リストをパース
        while (i < lines.length) {
          const qLine = lines[i];
          const qTrimmed = qLine.trim();

          if (!qTrimmed || qTrimmed.startsWith('#')) {
            i++;
            continue;
          }

          // questions ブロックを抜けた（インデントが2以下に戻った）
          if (indentLevel(qLine) <= 2 && !qTrimmed.startsWith('-')) break;

          if (qTrimmed.startsWith('- ')) {
            // 新しい question エントリの開始
            const question: { type: string; text: string; options: string[] } = {
              type: 'single',
              text: '',
              options: [],
            };
            // "- type: single" のように同じ行にキーがある場合
            const inlineKv = qTrimmed.slice(2).trim();
            if (inlineKv.startsWith('type:')) {
              question.type = stripQuotes(inlineKv.slice('type:'.length).trim());
            }
            i++;

            // question の各フィールドをパース（インデント4〜6）
            while (i < lines.length) {
              const fLine = lines[i];
              const fTrimmed = fLine.trim();

              if (!fTrimmed || fTrimmed.startsWith('#')) {
                i++;
                continue;
              }

              // 次の question エントリ or questions ブロック外へ
              if (fTrimmed.startsWith('- ') && indentLevel(fLine) <= 4) break;
              if (indentLevel(fLine) <= 2) break;

              if (fTrimmed.startsWith('type:')) {
                question.type = stripQuotes(fTrimmed.slice('type:'.length).trim());
                i++;
              } else if (fTrimmed.startsWith('text:')) {
                question.text = stripQuotes(fTrimmed.slice('text:'.length).trim());
                i++;
              } else if (fTrimmed.startsWith('answer:')) {
                // answer フィールドは意図的に読み捨てる（フロントエンドに露出しない）
                i++;
              } else if (fTrimmed.startsWith('options:')) {
                i++; // "options:" 行を読み飛ばす
                // options リストをパース
                while (i < lines.length) {
                  const oLine = lines[i];
                  const oTrimmed = oLine.trim();

                  if (!oTrimmed || oTrimmed.startsWith('#')) {
                    i++;
                    continue;
                  }

                  // options ブロックを抜けた
                  if (indentLevel(oLine) <= 6 && !oTrimmed.startsWith('- ')) break;
                  if (!oTrimmed.startsWith('- ')) break;

                  question.options.push(stripQuotes(oTrimmed.slice(2).trim()));
                  i++;
                }
              } else {
                i++;
              }
            }

            rawQuestions.push(question);
          } else {
            i++;
          }
        }
      } else {
        i++;
      }
    }

    // type の正規化と検証
    const questions: QuizQuestion[] = rawQuestions
      .filter((q) => q.text && q.options.length > 0)
      .map((q) => ({
        type: q.type === 'multiple' ? 'multiple' : 'single',
        text: q.text,
        options: q.options,
      }));

    if (questions.length === 0) return null;

    // YAML内のcourseIdがあればそちらを優先、なければ引数のcourseIdを使う
    const finalCourseId = parsedCourseId ?? courseId;

    return {
      title,
      quizId: `${finalCourseId}-quiz-01`,
      courseId: finalCourseId,
      passingScore,
      questions,
    };
  } catch {
    // パースエラーは呼び出し元に null で伝える
    return null;
  }
}
