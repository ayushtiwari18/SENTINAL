/**
 * CopilotPage — SENTINAL Security Co-Pilot
 *
 * A multi-turn chat interface powered by Gemini Flash.
 * Analysts can ask questions about attacks, payloads, CVEs,
 * remediation steps, and platform usage.
 *
 * Design:
 *   - Matches the existing SENTINAL dark theme exactly
 *   - Uses Panel, PageWrapper, LoadingState from shared UI components
 *   - Conversation history kept in local state (resets on page reload by design)
 *   - Graceful degradation: if Gemini is not configured, shows a clear error card
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { copilotChat } from '../services/api';
import PageWrapper  from '../components/layout/PageWrapper';
import Panel        from '../components/ui/Panel';

// ── Icons ──────────────────────────────────────────────────────────────────
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconBot = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    <line x1="12" y1="3" x2="12" y2="7"/>
    <circle cx="8.5" cy="16" r="1"/>
    <circle cx="15.5" cy="16" r="1"/>
    <line x1="9" y1="20" x2="15" y2="20"/>
  </svg>
);

const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const IconClear = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// ── Suggested starter prompts ─────────────────────────────────────────────────
const SUGGESTED_PROMPTS = [
  'What is a SQL injection attack and how does it work?',
  'Explain the difference between high and critical severity',
  'How do I remediate an XSS vulnerability in Express.js?',
  'What does a confidence score of 0.95 mean?',
  'How does SENTINAL detect SSRF attacks?',
  'What MITRE ATT&CK technique covers command injection?',
];

// ── Simple markdown renderer (bold, code, line breaks) ───────────────────────
function renderMarkdown(text) {
  // Split into lines, render inline markdown per line
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Headings
    if (line.startsWith('### ')) return <h4 key={i} style={mdStyles.h4}>{line.slice(4)}</h4>;
    if (line.startsWith('## '))  return <h3 key={i} style={mdStyles.h3}>{line.slice(3)}</h3>;
    if (line.startsWith('# '))   return <h2 key={i} style={mdStyles.h2}>{line.slice(2)}</h2>;
    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <li key={i} style={mdStyles.li}>{renderInline(line.slice(2))}</li>;
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      return <li key={i} style={mdStyles.li}>{renderInline(line.replace(/^\d+\.\s/, ''))}</li>;
    }
    // Empty line = spacer
    if (!line.trim()) return <br key={i} />;
    // Normal paragraph line
    return <p key={i} style={mdStyles.p}>{renderInline(line)}</p>;
  });
}

function renderInline(text) {
  // Replace **bold**, `code`, and preserve rest
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} style={mdStyles.code}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

const mdStyles = {
  h2: { fontSize: 'var(--text-md)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)', margin: '12px 0 4px', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' },
  h3: { fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: '10px 0 4px' },
  h4: { fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-secondary)', margin: '8px 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' },
  p:  { margin: '2px 0', lineHeight: 1.6, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' },
  li: { margin: '2px 0 2px 16px', lineHeight: 1.6, color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', listStyleType: 'disc' },
  code: { fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', background: 'var(--color-code-bg)', color: 'var(--color-code)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' },
};

// ── Main Component ─────────────────────────────────────────────────────────────────
export default function CopilotPage() {
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || input).trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', parts: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Build history excluding the last user message (that's the current message)
      const history = newMessages.slice(0, -1);
      const reply = await copilotChat(history, trimmed);
      setMessages(prev => [...prev, reply]);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'AI service error.';
      setError(msg);
      // Remove the user message so they can retry
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, messages, loading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
    setInput('');
  };

  const isEmpty = messages.length === 0;

  return (
    <PageWrapper>
      <div className="page-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--navbar-height) - 48px)', minHeight: 0 }}>

        {/* Page Header */}
        <div className="page-header" style={{ flexShrink: 0, marginBottom: 'var(--space-4)' }}>
          <div className="page-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ color: 'var(--color-accent)', display: 'flex' }}><IconBot /></span>
              <h1 className="page-title">Security Co-Pilot</h1>
            </div>
            <p className="page-subtitle">Gemini Flash · Ask anything about attacks, payloads, CVEs, or remediation</p>
          </div>
          {!isEmpty && (
            <div className="page-actions">
              <button className="btn btn-ghost btn-sm" onClick={clearChat} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <IconClear /> Clear chat
              </button>
            </div>
          )}
        </div>

        {/* Chat window + input stacked, filling remaining height */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 'var(--space-3)' }}>

          {/* Messages area */}
          <div style={styles.messageArea}>
            {isEmpty ? (
              <div style={styles.emptyState}>
                <span style={{ color: 'var(--color-accent)', marginBottom: 'var(--space-4)', display: 'flex' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                <h3 style={{ color: 'var(--color-text)', margin: '0 0 var(--space-2)' }}>SENTINAL Co-Pilot</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)', textAlign: 'center', maxWidth: '420px' }}>
                  Your AI security analyst. Ask about attack types, CVEs, remediation, or anything in the SENTINAL platform.
                </p>
                <div style={styles.suggestions}>
                  {SUGGESTED_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      style={styles.suggestionBtn}
                      onClick={() => sendMessage(prompt)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={styles.messages}>
                {messages.map((msg, i) => (
                  <div key={i} style={msg.role === 'user' ? styles.userRow : styles.botRow}>
                    <div style={msg.role === 'user' ? styles.userAvatar : styles.botAvatar}>
                      {msg.role === 'user' ? <IconUser /> : <IconBot />}
                    </div>
                    <div style={msg.role === 'user' ? styles.userBubble : styles.botBubble}>
                      {msg.role === 'user'
                        ? <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>{msg.parts}</p>
                        : <div>{renderMarkdown(msg.parts)}</div>
                      }
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div style={styles.botRow}>
                    <div style={styles.botAvatar}><IconBot /></div>
                    <div style={styles.botBubble}>
                      <div style={styles.typing}>
                        <span style={{ ...styles.dot, animationDelay: '0ms' }} />
                        <span style={{ ...styles.dot, animationDelay: '150ms' }} />
                        <span style={{ ...styles.dot, animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={styles.errorCard}>
                    <strong style={{ color: 'var(--color-critical)' }}>Error: </strong>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{error}</span>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div style={styles.inputBar}>
            <textarea
              ref={inputRef}
              style={styles.textarea}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the Co-Pilot anything... (Enter to send, Shift+Enter for new line)"
              rows={1}
              disabled={loading}
            />
            <button
              style={{ ...styles.sendBtn, opacity: (!input.trim() || loading) ? 0.4 : 1 }}
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
            >
              <IconSend />
            </button>
          </div>
        </div>

      </div>

      {/* Typing dots animation */}
      <style>{`
        @keyframes copilot-dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </PageWrapper>
  );
}

const styles = {
  messageArea: {
    flex: 1,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-8)',
  },
  suggestions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-2)',
    width: '100%',
    maxWidth: '640px',
  },
  suggestionBtn: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--text-xs)',
    padding: 'var(--space-2) var(--space-3)',
    cursor: 'pointer',
    textAlign: 'left',
    lineHeight: 1.5,
    transition: 'border-color 150ms ease',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
  },
  userRow: { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexDirection: 'row-reverse' },
  botRow:  { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' },
  userAvatar: {
    flexShrink: 0, width: '28px', height: '28px',
    borderRadius: 'var(--radius-full)',
    background: 'var(--color-accent-dim)',
    color: 'var(--color-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  botAvatar: {
    flexShrink: 0, width: '28px', height: '28px',
    borderRadius: 'var(--radius-full)',
    background: 'rgba(0,200,180,0.08)',
    color: 'var(--color-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  userBubble: {
    background: 'var(--color-accent-dim)',
    border: '1px solid var(--color-accent)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-2) var(--space-4)',
    maxWidth: '70%',
  },
  botBubble: {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-3) var(--space-4)',
    maxWidth: '80%',
    flex: 1,
  },
  typing: { display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' },
  dot: {
    display: 'inline-block',
    width: '6px', height: '6px',
    borderRadius: '50%',
    background: 'var(--color-accent)',
    animation: 'copilot-dot-bounce 1.2s ease-in-out infinite',
  },
  errorCard: {
    background: 'var(--color-critical-dim)',
    border: '1px solid var(--color-critical)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-4)',
    fontSize: 'var(--text-sm)',
  },
  inputBar: {
    display: 'flex',
    gap: 'var(--space-3)',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-sm)',
    padding: 'var(--space-3) var(--space-4)',
    resize: 'none',
    fontFamily: 'var(--font-body)',
    lineHeight: 1.5,
    outline: 'none',
    transition: 'border-color 150ms ease',
    minHeight: '44px',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  sendBtn: {
    background: 'var(--color-accent)',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: '#000',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 150ms ease',
  },
};
