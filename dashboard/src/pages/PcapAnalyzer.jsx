/**
 * PcapAnalyzer
 * Route: /pcap
 *
 * Upload a .pcap file → calls POST /api/pcap/upload → shows:
 *   - Summary bar  (analyzed / attacks found / saved / skipped)
 *   - Results table per detected attack
 *
 * Attacks detected here also appear in LiveAttackFeed via Socket.io automatically.
 */
import React, { useState, useRef } from 'react';
import { uploadPcap } from '../services/api';

const SEV_COLORS = {
  critical: '#f44747',
  high:     '#ff8c00',
  medium:   '#dcdcaa',
  low:      '#4ec9b0',
  none:     '#555',
};

const TYPE_LABELS = {
  sqli:               'SQL Injection',
  xss:                'XSS',
  traversal:          'Path Traversal',
  command_injection:  'Command Injection',
  ssrf:               'SSRF',
  lfi_rfi:            'LFI / RFI',
  brute_force:        'Brute Force',
  hpp:                'HTTP Param Pollution',
  xxe:                'XXE',
  webshell:           'Webshell',
  unknown:            'Unknown',
};

export default function PcapAnalyzer() {
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);   // { analyzed, attacks_found, attacks_saved, skipped }
  const [attacks, setAttacks]   = useState([]);     // raw attack objects from response
  const [error, setError]       = useState(null);
  const inputRef                = useRef();

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.pcap')) {
      setError('Only .pcap files are accepted.');
      return;
    }
    setFile(f);
    setResult(null);
    setAttacks([]);
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
    setAttacks([]);
    try {
      const data = await uploadPcap(file);
      // data = { analyzed, attacks_found, attacks_saved, skipped }
      // Note: full attack objects come back via socket attack:new in LiveAttackFeed
      // Here we show the summary + what came back in the response
      setResult(data);
      // The backend doesn't return full attack objects in summary,
      // so we indicate they appear in the Live Feed
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setAttacks([]);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      <h2 style={{ marginBottom: 4, color: '#e0e0e0' }}>PCAP Analyzer</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 13 }}>
        Upload a <code>.pcap</code> capture file. Every HTTP request is extracted,
        run through the Detection Engine, and saved. Confirmed attacks appear
        in the Live Attack Feed in real time.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#00d4aa' : file ? '#00d4aa55' : '#444'}`,
          borderRadius: 8,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#00d4aa11' : '#1a1a1a',
          transition: 'all 0.15s',
          marginBottom: 16,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pcap"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {file ? (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
            <div style={{ color: '#00d4aa', fontWeight: 600 }}>{file.name}</div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
              {(file.size / 1024).toFixed(1)} KB — click to change
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🗂️</div>
            <div style={{ color: '#888' }}>Drag & drop a <strong>.pcap</strong> file here</div>
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>or click to browse — max 100 MB</div>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          style={{
            background: file && !loading ? '#00d4aa' : '#333',
            color: file && !loading ? '#000' : '#555',
            border: 'none',
            padding: '8px 24px',
            borderRadius: 4,
            cursor: file && !loading ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {loading ? 'Analyzing…' : 'Analyze'}
        </button>
        {(file || result) && (
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              color: '#888',
              border: '1px solid #444',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#f4474722',
          border: '1px solid #f44747',
          borderRadius: 4,
          padding: '10px 16px',
          color: '#f44747',
          marginBottom: 20,
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Loading spinner */}
      {loading && (
        <div style={{ color: '#00d4aa', fontSize: 13, marginBottom: 20 }}>
          ⏳ Processing packets… this may take a moment for large files.
        </div>
      )}

      {/* Summary */}
      {result && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 24,
          }}>
            {[
              { label: 'Packets Analyzed', value: result.analyzed,      color: '#e0e0e0' },
              { label: 'Attacks Found',    value: result.attacks_found, color: result.attacks_found > 0 ? '#f44747' : '#4ec9b0' },
              { label: 'Attacks Saved',    value: result.attacks_saved, color: result.attacks_saved > 0 ? '#ff8c00' : '#4ec9b0' },
              { label: 'Skipped',          value: result.skipped,       color: result.skipped > 0 ? '#dcdcaa' : '#555' },
            ].map(card => (
              <div key={card.label} style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '16px 20px',
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {result.attacks_found > 0 ? (
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '14px 18px',
              fontSize: 13,
              color: '#888',
            }}>
              ✅ <strong style={{ color: '#00d4aa' }}>{result.attacks_saved}</strong> attack
              {result.attacks_saved !== 1 ? 's' : ''} saved to MongoDB and emitted to the{' '}
              <strong style={{ color: '#e0e0e0' }}>Live Attack Feed</strong> in real time.
              Head to <a href="/attacks" style={{ color: '#00d4aa' }}>Attacks</a> to view them.
            </div>
          ) : (
            <div style={{
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 6,
              padding: '14px 18px',
              fontSize: 13,
              color: '#4ec9b0',
            }}>
              ✅ No threats detected in this capture file.
            </div>
          )}
        </>
      )}
    </div>
  );
}
