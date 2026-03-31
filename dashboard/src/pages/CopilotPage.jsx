/**
 * CopilotPage — SENTINAL AI Security Co-Pilot
 *
 * Features:
 *   - SSE streaming via GET /api/gemini/chat/stream (tokens appear as typed)
 *   - Conversation memory — last 6 turns sent as history on every request
 *     FIX: assistant reply text is now captured correctly from the stream
 *   - AI-generated follow-up suggestions rendered as clickable chips
 *   - Source citations — "Grounded in N events" with link to Attacks page
 *   - Copy answer button per response
 *   - Export as incident note (.txt download) per response
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageWrapper  from '../components/layout/PageWrapper';
import Panel        from '../components/ui/Panel';
import { geminiChatStream } from '../services/api';

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconBot = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <line x1="12" y1="3" x2="12" y2="7" />
    <circle cx="9" cy="16" r="1" fill="currentColor" />
    <circle cx="15" cy="16" r="1" fill="currentColor" />
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const IconSpinner = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
const IconClear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);
const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const IconLink = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconDownload = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ── Suggested starter questions ───────────────────────────────────────────────
const SUGGESTIONS = [
  'What are the top 3 attack types in the last 24 hours?',
  'Which IP address is the most aggressive attacker?',
  'How many critical attacks were not blocked?',
  'What SQL injection payloads have been detected?',
  'Which attacks have the highest confidence scores?',
  'Are there any signs of a coordinated attack campaign?',
];

// ── Export answer as incident note ────────────────────────────────────────────
function exportNote(msg) {
  const ts = new Date().toISOString();
  const lines = [
    'SENTINAL AI — Incident Note',
    `Generated: ${ts}`,
    '',
    `Sources: ${msg.sourcedEventIds?.length || 0} telemetry event(s)`,
    '',
    '─────────────────────────────────────────',
    '',
    msg.content,
    '',
    '─────────────────────────────────────────',
    'Built for HackByte 4.0 — SENTINAL©2026',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sentinal-note-${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Message bubble component ──────────────────────────────────────────────────
function MessageBubble({ msg, onSuggestionClick }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = React.useState(false);
  const navigate = useNavigate();

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
    }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30,
        borderRadius: 'var(--radius-full)',
        background: isUser ? 'var(--color-accent)' : 'var(--color-surface-3)',
        border: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: isUser ? 'var(--color-bg)' : 'var(--color-accent)',
      }}>
        {isUser ? <IconUser /> : <IconBot />}
      </div>

      {/* Bubble + metadata */}
      <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
        alignItems: isUser ? 'flex-end' : 'flex-start' }}>

        <div style={{
          background: isUser ? 'var(--color-accent)' : 'var(--color-surface-2)',
          color: isUser ? 'var(--color-bg)' : 'var(--color-text)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          borderRadius: isUser
            ? 'var(--radius-lg) var(--radius-sm) var(--radius-lg) var(--radius-lg)'
            : 'var(--radius-sm) var(--radius-lg) var(--radius-lg) var(--radius-lg)',
          padding: 'var(--space-3) var(--space-4)',
          fontSize: 'var(--text-sm)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          position: 'relative',
        }}>
          {/* Streaming cursor */}
          {msg.streaming ? (
            <>{msg.content}<span style={{
              display: 'inline-block', width: 2, height: '1em',
              background: 'var(--color-accent)', marginLeft: 2,
              animation: 'blink 0.8s step-end infinite', verticalAlign: 'text-bottom',
            }} /></>
          ) : msg.content}
        </div>

        {/* Assistant metadata row */}
        {!isUser && !msg.streaming && msg.content && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {/* Copy button */}
            <button onClick={handleCopy} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
              padding: '2px 4px', borderRadius: 'var(--radius-sm)',
            }}>
              <IconCopy /> {copied ? 'Copied!' : 'Copy'}
            </button>

            {/* Export as incident note */}
            <button onClick={() => exportNote(msg)} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)',
              padding: '2px 4px', borderRadius: 'var(--radius-sm)',
            }}>
              <IconDownload /> Export note
            </button>

            {/* Source citation */}
            {msg.sourcedEventIds && msg.sourcedEventIds.length > 0 && (
              <button
                onClick={() => navigate('/attacks')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 'var(--text-xs)', color: 'var(--color-accent)',
                  padding: '2px 4px', borderRadius: 'var(--radius-sm)',
                }}
              >
                <IconLink /> Grounded in {msg.sourcedEventIds.length} event{msg.sourcedEventIds.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && !msg.streaming && msg.suggestions && msg.suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            {msg.suggestions.map((s, i) => (
              <button key={i} onClick={() => onSuggestionClick(s)} style={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                padding: '3px var(--space-3)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CopilotPage() {
  const [messages,  setMessages]  = useState([]);
  // conversationHistory mirrors messages in the { role, text } shape the backend expects
  const [history,   setHistory]   = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const sourceRef   = useRef(null); // holds active EventSource

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Cleanup EventSource on unmount
  useEffect(() => () => sourceRef.current?.close(), []);

  const handleSend = useCallback((question) => {
    const q = (question ?? input).trim();
    if (!q || loading) return;

    setInput('');
    setError(null);

    const userMsg = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);

    // Add a streaming placeholder for assistant
    const assistantId = Date.now();
    setMessages(prev => [...prev, {
      id: assistantId, role: 'assistant', content: '', streaming: true,
      suggestions: [], sourcedEventIds: [],
    }]);
    setLoading(true);

    // Close any previous stream
    if (sourceRef.current) sourceRef.current.close();

    const es = geminiChatStream(q, history);
    sourceRef.current = es;

    // Accumulate the full answer text so we can save it to history correctly
    let accumulatedAnswer = '';

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.type === 'chunk') {
          accumulatedAnswer += event.text;
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: m.content + event.text }
              : m
          ));
        }

        if (event.type === 'done') {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, streaming: false, suggestions: event.suggestions || [], sourcedEventIds: event.sourcedEventIds || [] }
              : m
          ));
          // FIX: save the actual accumulated answer text (was '' before)
          setHistory(prev => [
            ...prev,
            { role: 'user',  text: q },
            { role: 'model', text: accumulatedAnswer },
          ].slice(-12)); // keep last 6 turns (12 entries)
          setLoading(false);
          es.close();
          setTimeout(() => inputRef.current?.focus(), 100);
        }

        if (event.type === 'error') {
          const errMsg = event.errorCode === 'QUOTA_EXHAUSTED'
            ? 'AI quota exhausted for today. Try again tomorrow.'
            : 'AI service error. Please try again.';
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: errMsg, streaming: false }
              : m
          ));
          setError(errMsg);
          setLoading(false);
          es.close();
        }
      } catch { /* ignore JSON parse errors on malformed chunks */ }
    };

    es.onerror = () => {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Connection error. Please try again.', streaming: false }
          : m
      ));
      setError('Stream connection failed.');
      setLoading(false);
      es.close();
    };
  }, [input, loading, history]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    sourceRef.current?.close();
    setMessages([]);
    setHistory([]);
    setError(null);
    setInput('');
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const isEmpty = messages.length === 0;

  return (
    <PageWrapper>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="page-title-group">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ color: 'var(--color-accent)' }}><IconBot /></span>
              AI Security Co-Pilot
            </h1>
            <p className="page-subtitle">
              Ask questions about your live attack data. Every answer is grounded in real MongoDB telemetry.
            </p>
          </div>
          {messages.length > 0 && (
            <div className="page-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearChat}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                <IconClear /> Clear
              </button>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <Panel style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* Message area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', minHeight: 0 }}>

            {/* Empty state */}
            {isEmpty && (
              <div style={{ textAlign: 'center', padding: 'var(--space-8) var(--space-4)' }}>
                <div style={{
                  width: 56, height: 56,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  color: 'var(--color-accent)',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    <line x1="12" y1="3" x2="12" y2="7" />
                    <circle cx="9" cy="16" r="1" fill="currentColor" />
                    <circle cx="15" cy="16" r="1" fill="currentColor" />
                  </svg>
                </div>
                <p style={{ color: 'var(--color-text)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-1)' }}>
                  SENTINEL AI is ready
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                  Ask anything about your live attack telemetry
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', justifyContent: 'center', maxWidth: 600, margin: '0 auto' }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => handleSend(s)} style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-full)',
                      padding: 'var(--space-2) var(--space-3)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)'; e.currentTarget.style.color = 'var(--color-accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <MessageBubble key={msg.id || i} msg={msg} onSuggestionClick={handleSend} />
            ))}

            {/* Loading indicator (only shows before first streaming chunk) */}
            {loading && messages[messages.length - 1]?.streaming && messages[messages.length - 1]?.content === '' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)', marginLeft: 42,
              }}>
                <IconSpinner /> Analyzing attack data...
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-border)' }} />

          {/* Input area */}
          <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
            {error && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-critical)', marginBottom: 'var(--space-2)' }}>{error}</p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your attack data... (Enter to send)"
                rows={2}
                disabled={loading}
                style={{
                  flex: 1, resize: 'none',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text)',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-accent)'}
                onBlur={e  => e.target.style.borderColor = 'var(--color-border)'}
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', paddingBlock: 'var(--space-3)' }}
              >
                {loading ? <IconSpinner /> : <IconSend />}
                {loading ? 'Thinking…' : 'Send'}
              </button>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              Shift+Enter for new line · streaming · conversation memory active ({history.length / 2} turns) · answers grounded in live MongoDB attack telemetry
            </p>
          </div>
        </Panel>
      </div>
    </PageWrapper>
  );
}
