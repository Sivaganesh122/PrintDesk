import React, { useState } from 'react';
import { PRINT_STATE_LABELS } from '../utils/printStatus';

const formatTime = (value) => new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// The printers connected to the server's computer, and what has passed between them and PrintDesk
const PrintersPanel = ({ info, events, onShowLog }) => {
  const [logOpen, setLogOpen] = useState(false);

  const toggleLog = () => {
    setLogOpen(!logOpen);
    onShowLog(!logOpen);
  };

  return (
    <section className="printers-panel" aria-label="Printers">
      <div className="printers-panel-head">
        <h3>Printers</h3>
        <button type="button" className="printers-log-toggle" onClick={toggleLog} aria-expanded={logOpen}>
          {logOpen ? 'Hide printer activity' : 'Show printer activity'}
        </button>
      </div>

      {!info ? (
        <p className="printers-note">Checking the printers...</p>
      ) : !info.available ? (
        <p className="printers-note">{info.reason}</p>
      ) : info.printers.length === 0 ? (
        <p className="printers-note">No printers are installed on this computer.</p>
      ) : (
        <ul className="printer-list">
          {info.printers.map((p) => (
            <li key={p.name} className={`printer-item ${p.virtual ? 'virtual' : p.ok ? 'ok' : 'problem'}`}>
              <span className="printer-dot" aria-hidden="true" />
              <span className="printer-name">
                {p.name}
                {p.isDefault && <span className="printer-tag">Default</span>}
              </span>
              <span className="printer-status">
                {p.virtual ? 'Not a paper printer' : p.statusText}
                {p.queued > 0 && ` · ${p.queued} waiting`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {logOpen && (
        <div className="printer-log">
          {events.length === 0 ? (
            <p className="printers-note">Nothing has been printed yet.</p>
          ) : (
            <table>
              <thead>
                <tr><th scope="col">Time</th><th scope="col">Printer</th><th scope="col">Job</th><th scope="col">What happened</th></tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className={`log-${e.state}`}>
                    <td>{formatTime(e.created_at)}</td>
                    <td>{e.printer || '-'}</td>
                    <td>{e.tracking_number ? `#${e.tracking_number}` : '-'}</td>
                    <td>
                      <strong>{PRINT_STATE_LABELS[e.state] || e.state}</strong>
                      {e.message && e.message !== PRINT_STATE_LABELS[e.state] && `: ${e.message}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
};

export default PrintersPanel;
