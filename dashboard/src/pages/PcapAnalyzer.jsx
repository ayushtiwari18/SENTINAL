/**
 * PcapAnalyzer
 * Route: /pcap
 *
 * Upload a .pcap file → calls POST /api/pcap/upload → shows:
 *   - Summary bar  (packets / attacks found / saved / skipped / time)
 *   - Attack breakdown table per detection source
 *
 * Attacks also appear in LiveAttackFeed via Socket.io automatically.
 */
import React, { useState, useRef } from 'react';
import { uploadPcap } from '../services/api';

const SEV_COLORS = {
  critical: '#f44747',
  high:     '#ff8c00',
  medium:   '#dcdcaa',
  low:      '#4ec9b0',
};

const TYPE_LABELS = {
  sqli:               'SQL Injection',
  xss:                'XSS',
  recon:              'Port Scan / Recon',
  traversal:          'Path Traversal',
  command_injection:  'Command Injection',
  ssrf:               'SSRF',
  lfi_rfi:            'LFI / RFI',
  brute_force:        'Brute Force',
  ddos:               'DoS / DDoS / Flood',
  hpp:                'HTTP Param Pollution',
  xxe:                'XXE',
  webshell:           'Webshell',
  unknown:            'Unknown',
};

export default function PcapAnalyzer() {
  const [file, setFile]         = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const inputRef                = useRef();

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
      // uploadPcap → api.js → unwrap → returns res.data.data
      // Backend v2 shape:
      // {
      //   total_packets, parsed_packets, total_flows, processing_time_s,
      //   local_attacks_found, engine_attacks_found,
      //   attacks_saved, skipped_engine
      // }
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

  // Derived totals from v2 response
  const totalAttacksFound = result
    ? (result.local_attacks_found ?? 0) + (result.engine_attacks_found ?? 0)
    : 0;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4, color: '#e0e0e0' }}>PCAP Analyzer</h2>
      <p style={{ color: '#666', marginBottom: 24, fontSize: 13 }}>
        Upload a <code>.pcap</code> capture file. Every HTTP request is extracted,
        run through the Detection Engine, and saved. Confirmed attacks appear
        in the Live Attack Feed in real time.
      </p>

      {/* ── Drop zone ───────────────────────────────────────────────── */}
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
          accept=".pcap,.pcapng"
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
            <div style={{ color: '#555', fontSize: 12, marginTop: 4 }}>or click to browse — max 500 MB</div>
          </>
        )}
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────── */}
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

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background: '#f4474722', border: '1px solid #f44747',
          borderRadius: 4, padding: '10px 16px',
          color: '#f44747', marginBottom: 20, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── Loading ─────────────────────────────────────────────────── */}
      {loading && (
        <div style={{ color: '#00d4aa', fontSize: 13, marginBottom: 20 }}>
          ⏳ Processing packets… this may take a moment for large files.
        </div>
      )}

      {/* ── Summary cards ───────────────────────────────────────────── */}
      {result && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginBottom: 20,
          }}>
            {[
              {
                label: 'Packets Analyzed',
                // v2 uses total_packets (old schema used analyzed)
                value: result.total_packets ?? result.analyzed ?? '—',
                color: '#e0e0e0',
              },
              {
                label: 'Local Detections',
                value: result.local_attacks_found ?? 0,
                color: (result.local_attacks_found ?? 0) > 0 ? '#f44747' : '#4ec9b0',
              },
              {
                label: 'Engine Detections',
                value: result.engine_attacks_found ?? 0,
                color: (result.engine_attacks_found ?? 0) > 0 ? '#ff8c00' : '#4ec9b0',
              },
              {
                label: 'Attacks Saved',
                value: result.attacks_saved ?? 0,
                color: (result.attacks_saved ?? 0) > 0 ? '#ff8c00' : '#4ec9b0',
              },
              {
                label: 'Skipped (no engine)',
                value: result.skipped_engine ?? result.skipped ?? 0,
                color: (result.skipped_engine ?? result.skipped ?? 0) > 0 ? '#dcdcaa' : '#555',
              },
            ].map(card => (
              <div key={card.label} style={{
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 6,
                padding: '16px 20px',
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, color: card.color }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{card.label}</div>
              </div>
            ))}
          </div>

          {/* Processing time badge */}
          {result.processing_time_s !== undefined && (
            <div style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>
              ⚡ Processed in <strong style={{ color: '#888' }}>
                {(result.processing_time_s * 1000).toFixed(1)} ms
              </strong>
              {result.total_flows !== undefined && (
                <> · <strong style={{ color: '#888' }}>{result.total_flows}</strong> flows built</>
              )}
            </div>
          )}

          {/* ── Result message ──────────────────────────────────────── */}
          {totalAttacksFound > 0 ? (
            <div style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 6, padding: '14px 18px',
              fontSize: 13, color: '#888',
            }}>
              🚨 <strong style={{ color: '#f44747' }}>{totalAttacksFound}</strong> attack signal
              {totalAttacksFound !== 1 ? 's' : ''} detected
              {' '}(<strong style={{ color: '#00d4aa' }}>{result.attacks_saved ?? 0}</strong> saved
              to MongoDB). Head to{' '}
              <a href="/attacks" style={{ color: '#00d4aa' }}>Attacks</a> or watch the{' '}
              <strong style={{ color: '#e0e0e0' }}>Live Attack Feed</strong> on the Dashboard.
            </div>
          ) : (
            <div style={{
              background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 6, padding: '14px 18px',
              fontSize: 13, color: '#4ec9b0',
            }}>
              ✅ No threats detected in this capture file.
            </div>
          )}
        </>
      )}
    </div>
  );
}
