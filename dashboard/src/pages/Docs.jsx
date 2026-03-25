import React from 'react';

export default function Docs() {
  return (
    <div>
      <h2>Integration Docs</h2>

      <h4>1. Install middleware</h4>
      <pre>npm install @sentinal/middleware</pre>

      <h4>2. Add to your Express app</h4>
      <pre>{`const sentinal = require('@sentinal/middleware');
app.use(sentinal({ projectId: 'my-app', gatewayUrl: 'http://localhost:3000' }));`}</pre>

      <h4>3. That's it</h4>
      <p>Every request is now monitored. Open the <a href="/dashboard">Dashboard</a> to see live data.</p>

      <h4>API Endpoints</h4>
      <table border="1" cellPadding="6">
        <thead><tr><th>Method</th><th>Endpoint</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td>GET</td><td>/api/stats</td><td>Overall stats</td></tr>
          <tr><td>GET</td><td>/api/attacks/recent</td><td>Recent attack list</td></tr>
          <tr><td>GET</td><td>/api/attacks/:id/forensics</td><td>Full forensic report</td></tr>
          <tr><td>GET</td><td>/api/alerts</td><td>Alert list</td></tr>
          <tr><td>PATCH</td><td>/api/alerts/:id/read</td><td>Mark alert read</td></tr>
          <tr><td>GET</td><td>/api/logs/recent</td><td>Raw request logs</td></tr>
          <tr><td>GET</td><td>/api/service-status</td><td>Service health</td></tr>
          <tr><td>GET</td><td>/api/health</td><td>Gateway health</td></tr>
          <tr><td>GET</td><td>/api/intel/:ip</td><td>IP threat intelligence</td></tr>
        </tbody>
      </table>
    </div>
  );
}
