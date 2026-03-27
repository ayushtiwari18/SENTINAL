/**
 * PcapAnalyzer — redesigned with full design system.
 * Drag-and-drop preserved, all result parsing preserved.
 */
import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { uploadPcap } from '../services/api';
import Panel      from '../components/ui/Panel';
import StatCard   from '../components/ui/StatCard';
import PageWrapper from '../components/layout/PageWrapper';

export default function PcapAnalyzer() {
  const [file,     setFile]     = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.pcap') && !f.name.endsWith('.pcapng')) {
      setError('Only .pcap / .pcapng files are accepted.');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadPcap(file);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const totalAttacksFound = result
    ? (result.local_attacks_found ?? 0) + (result.engine_attacks_found ?? 0)
    : 0;

  return (
    <PageWrapper>
      <div className="page-container">

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">PCAP Analyzer</h1>
            <p className="page-subtitle">
              Upload a <code>.pcap</code> capture. Every HTTP request is extracted,
              run through the Detection Engine, and saved. Confirmed attacks
              appear in the Live Attack Feed in real time.
            </p>
          </div>
        </div>

        <Panel>
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              ...styles.dropzone,
              borderColor: dragging ? 'var(--color-accent)' : file ? 'var(--color-accent-hover)' : 'var(--color-border-strong)',
              background:  dragging ? 'var(--color-accent-dim)' : 'var(--color-bg)',
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pcap,.pcapng"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
            {file ? (
              <>
                <span style={{ fontSize: '28px' }}>📦</span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--weight-semibold)' }}>{file.name}</span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '28px' }}>🗂️</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  Drag & drop a <strong>.pcap</strong> file here
                </span>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                  or click to browse — max 500 MB
                </span>
              </>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!file || loading}
              style={{ opacity: (!file || loading) ? 0.5 : 1 }}
            >
              {loading ? '⏳ Analyzing…' : 'Analyze'}
            </button>
            {(file || result) && (
              <button className="btn btn-ghost" onClick={reset}>Reset</button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBanner}>{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ color: 'var(--color-accent)', fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)' }}>
              Processing packets… this may take a moment for large files.
            </div>
          )}
        </Panel>

        {/* Results */}
        {result && (
          <>
            <div className="stat-grid section" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginTop: 'var(--space-4)' }}>
              <StatCard label="Packets Analyzed"    value={result.total_packets ?? result.analyzed ?? 0} />
              <StatCard label="Local Detections"    value={result.local_attacks_found   ?? 0} color={(result.local_attacks_found   ?? 0) > 0 ? 'var(--color-critical)' : 'var(--color-online)'} />
              <StatCard label="Engine Detections"   value={result.engine_attacks_found  ?? 0} color={(result.engine_attacks_found  ?? 0) > 0 ? 'var(--color-high)'     : 'var(--color-online)'} />
              <StatCard label="Attacks Saved"        value={result.attacks_saved         ?? 0} color={(result.attacks_saved         ?? 0) > 0 ? 'var(--color-warning)'  : 'var(--color-online)'} />
              <StatCard label="Skipped (no engine)" value={result.skipped_engine ?? result.skipped ?? 0} />
            </div>

            {result.processing_time_s !== undefined && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)' }}>
                ⚡ {(result.processing_time_s * 1000).toFixed(1)}ms
                {result.total_flows !== undefined && <> · {result.total_flows} flows</>}
              </p>
            )}

            <div style={{
              ...styles.resultBanner,
              borderColor:  totalAttacksFound > 0 ? 'var(--color-critical)' : 'var(--color-online)',
              background:   totalAttacksFound > 0 ? 'rgba(244,71,71,0.06)' : 'rgba(75,181,67,0.06)',
            }}>
              {totalAttacksFound > 0 ? (
                <>
                  🚨 <strong style={{ color: 'var(--color-critical)' }}>{totalAttacksFound}</strong> attack signal{totalAttacksFound !== 1 ? 's' : ''} detected
                  {' '}(<strong style={{ color: 'var(--color-accent)' }}>{result.attacks_saved ?? 0}</strong> saved to MongoDB).
                  {' '}Head to <Link to="/attacks" style={{ color: 'var(--color-accent)' }}>Attacks</Link> or watch the Live Feed on the Dashboard.
                </>
              ) : (
                <span style={{ color: 'var(--color-online)' }}>✅ No threats detected in this capture file.</span>
              )}
            </div>
          </>
        )}

      </div>
    </PageWrapper>
  );
}

const styles = {
  dropzone: {
    border: '2px dashed',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-7) var(--space-5)',
    textAlign: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-2)',
    transition: 'border-color 150ms ease, background 150ms ease',
  },
  errorBanner: {
    marginTop: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--color-critical)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-critical)',
    fontSize: 'var(--text-sm)',
    background: 'rgba(244,71,71,0.08)',
  },
  resultBanner: {
    marginTop: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
  },
};
