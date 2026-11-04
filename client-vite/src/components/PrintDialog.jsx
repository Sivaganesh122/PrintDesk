import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { pageRangesText } from '../utils/printStatus';

// PrintDesk's own print screen. It starts from the order's settings, lets the admin change
// them, and sends the job to a printer connected to the server's computer.
const PrintDialog = ({ job, printers, onPrint, onBrowserPrint, onClose }) => {
  const paperPrinters = (printers || []).filter((p) => !p.virtual);
  const [settings, setSettings] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Fills in the order's settings each time a job is opened
  useEffect(() => {
    if (!job) return;
    const preferred = paperPrinters.find((p) => p.isDefault) || paperPrinters[0];
    setSettings({
      printer: preferred?.name || '',
      pages: pageRangesText(job.selected_pages),
      copies: job.copies || 1,
      doubleSided: job.double_sided === true,
      color: job.color_type === 'Color',
      paperSize: job.paper_size || 'A4'
    });
    setError('');
    setSending(false);
    // Only a newly opened job resets the form, not a refreshed printer list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  if (!job || !settings) return null;

  const set = (field) => (e) => setSettings({ ...settings, [field]: e.target.value });
  const chosen = paperPrinters.find((p) => p.name === settings.printer);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await onPrint(job, { ...settings, copies: Number(settings.copies) });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send the job to the printer.');
      setSending(false);
    }
  };

  return (
    <Modal show onHide={onClose} centered>
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5 mb-0">Print #{job.tracking_number}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            {job.original_filename || 'Document'} for {job.customer_name}. These are the student's settings; change any of them before printing.
          </p>

          {paperPrinters.length === 0 ? (
            <Alert variant="warning" className="mb-0">
              No paper printer is connected to this computer. Connect one in Windows, or use the browser's print dialog instead.
            </Alert>
          ) : (
            <>
              <Form.Group className="mb-3" controlId="print-printer">
                <Form.Label>Printer</Form.Label>
                <Form.Select value={settings.printer} onChange={set('printer')} required>
                  {paperPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} - {p.statusText}{p.queued ? `, ${p.queued} waiting` : ''}
                    </option>
                  ))}
                </Form.Select>
                {chosen && !chosen.ok && (
                  <Form.Text className="text-danger">
                    {chosen.statusText}. The job will wait in the queue until this is fixed.
                  </Form.Text>
                )}
              </Form.Group>

              <Form.Group className="mb-3" controlId="print-pages">
                <Form.Label>Pages</Form.Label>
                <Form.Control value={settings.pages} onChange={set('pages')} placeholder="All pages" aria-describedby="print-pages-help" />
                <Form.Text id="print-pages-help">For example 1-3, 5. Leave empty for all pages.</Form.Text>
              </Form.Group>

              <div className="d-flex gap-3 flex-wrap">
                <Form.Group className="mb-3" controlId="print-copies" style={{ width: '6rem' }}>
                  <Form.Label>Copies</Form.Label>
                  <Form.Control type="number" min={1} max={10} value={settings.copies} onChange={set('copies')} required />
                </Form.Group>
                <Form.Group className="mb-3 flex-grow-1" controlId="print-paper">
                  <Form.Label>Paper size</Form.Label>
                  <Form.Select value={settings.paperSize} onChange={set('paperSize')}>
                    <option value="A4">A4</option>
                    <option value="A3">A3</option>
                  </Form.Select>
                </Form.Group>
              </div>

              <div className="d-flex gap-3 flex-wrap">
                <Form.Group className="mb-3 flex-grow-1" controlId="print-sides">
                  <Form.Label>Sides</Form.Label>
                  <Form.Select
                    value={settings.doubleSided ? 'double' : 'single'}
                    onChange={(e) => setSettings({ ...settings, doubleSided: e.target.value === 'double' })}
                  >
                    <option value="single">One side</option>
                    <option value="double">Both sides</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3 flex-grow-1" controlId="print-colour">
                  <Form.Label>Colour</Form.Label>
                  <Form.Select
                    value={settings.color ? 'color' : 'bw'}
                    onChange={(e) => setSettings({ ...settings, color: e.target.value === 'color' })}
                  >
                    <option value="bw">Black and white</option>
                    <option value="color">Colour</option>
                  </Form.Select>
                </Form.Group>
              </div>
            </>
          )}

          {error && <Alert variant="danger" className="mt-2 mb-0">{error}</Alert>}
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button variant="link" className="px-0" onClick={() => { onClose(); onBrowserPrint(job); }}>
            Use the browser's print dialog
          </Button>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="success" disabled={sending || paperPrinters.length === 0}>
              {sending ? 'Sending...' : 'Print'}
            </Button>
          </div>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default PrintDialog;
