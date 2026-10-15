import { useEffect, useRef } from 'react';

interface Props {
  message: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Render as a list row (`li`) or a plain block. */
  as?: 'li' | 'div';
}

/**
 * A small in-place confirmation used instead of window.confirm(), which
 * browsers may suppress after a few prompts and which is awkward on phones.
 * Focus lands on Cancel so a stray Enter never confirms.
 */
export function InlineConfirm({ message, detail, confirmLabel, onConfirm, onCancel, as = 'div' }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const Tag = as;
  return (
    <Tag className="confirm" role="group" aria-label={message}>
      <span className="item-text">
        <span className="item-name">{message}</span>
        {detail && <span className="item-meta">{detail}</span>}
      </span>
      <span className="confirm-actions">
        <button ref={cancelRef} type="button" className="btn btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-sm btn-danger-solid" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </span>
    </Tag>
  );
}
