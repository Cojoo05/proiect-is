import { useEffect } from 'react';

function ConfirmDialog({
  open,
  title = 'Ești sigur?',
  message,
  confirmLabel = 'Șterge',
  cancelLabel = 'Anulează',
  danger = true,
  loading = false,
  onConfirm,
  onCancel
}) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape' && !loading) onCancel?.();
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel?.();
      }}
    >
      <div className="modal-card modal-card--sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="modal-title" style={{ marginBottom: '10px' }}>
          {title}
        </h2>

        {message && <p className="modal-text">{message}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Se procesează...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
