/**
 * QuestionBox — 質問箱フォームコンポーネント。
 * Growiページ内に埋め込み、匿名で質問を投稿できるフォームを表示する。
 * 投稿された質問は管理者のみ閲覧可能なページとして作成される。
 */

import { useState } from 'react';
import { submitQuestion } from './api';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const COLOR = {
  mainGreen: '#1a661e',
  mainGreenDark: '#145218',
  gray: '#6b7280',
  textMuted: '#888',
  errorRed: '#e44141',
  errorRedBg: '#fff2f0',
  border: 'hsla(0,0%,78%,.5)',
  white: '#fff',
  bg: '#faf5f0',
  text: '#333',
  fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
};

export function QuestionBox() {
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const canSubmit = status === 'idle' && title.trim().length > 0 && question.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    setStatus('submitting');
    setErrorMessage('');
    try {
      await submitQuestion(title.trim(), question.trim());
      setStatus('success');
      setTitle('');
      setQuestion('');
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message || '送信に失敗しました');
    }
  }

  // 送信成功後に再入力可能にする
  function handleReset() {
    setStatus('idle');
    setErrorMessage('');
  }

  const containerStyle: React.CSSProperties = {
    fontFamily: COLOR.fontFamily,
    border: `1px solid ${COLOR.border}`,
    borderRadius: '8px',
    padding: '24px',
    backgroundColor: COLOR.white,
    maxWidth: '640px',
  };

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '120px',
    padding: '12px',
    border: `1px solid ${COLOR.border}`,
    borderRadius: '6px',
    fontFamily: COLOR.fontFamily,
    fontSize: '14px',
    lineHeight: '1.6',
    color: COLOR.text,
    resize: 'vertical',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const buttonBaseStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '10px 24px',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: COLOR.fontFamily,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };

  const submitButtonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    backgroundColor: canSubmit ? COLOR.mainGreen : COLOR.gray,
    color: COLOR.white,
    opacity: canSubmit ? 1 : 0.6,
    cursor: canSubmit ? 'pointer' : 'not-allowed',
  };

  const noteStyle: React.CSSProperties = {
    fontSize: '12px',
    color: COLOR.textMuted,
    marginTop: '12px',
    lineHeight: '1.5',
  };

  if (status === 'success') {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>&#10004;</div>
          <p style={{ fontSize: '14px', color: COLOR.text, margin: '0 0 16px 0' }}>
            質問を送信しました。管理者が確認後、回答を掲載します。
          </p>
          <button
            style={{ ...buttonBaseStyle, backgroundColor: COLOR.mainGreen, color: COLOR.white }}
            onClick={handleReset}
          >
            別の質問を送る
          </button>
        </div>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: `1px solid ${COLOR.border}`,
    borderRadius: '6px',
    fontFamily: COLOR.fontFamily,
    fontSize: '14px',
    color: COLOR.text,
    boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: '12px' }}>
        <input
          type="text"
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="タイトル"
          disabled={status === 'submitting'}
          maxLength={100}
        />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <textarea
          style={textareaStyle}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力してください"
          disabled={status === 'submitting'}
          maxLength={5000}
        />
      </div>

      <button
        style={submitButtonStyle}
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {status === 'submitting' ? '送信中...' : '質問を投稿する'}
      </button>

      {status === 'error' && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: COLOR.errorRedBg,
          color: COLOR.errorRed,
          borderRadius: '4px',
          fontSize: '13px',
        }}>
          {errorMessage}
        </div>
      )}

      <p style={noteStyle}>
        ※ 投稿された質問は管理者のみが閲覧できます。回答を追記した上で公開します。<br />
        ※ 個人が特定できる情報は匿名化した上で送信してください。
      </p>
    </div>
  );
}
