import type { RefObject } from 'react';
import { Search, X } from '../icons.ts';

interface Props {
  value: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchField({ value, onChange, inputRef }: Props) {
  return (
    <div className="search" role="search">
      <Search className="search-icon" size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        className="input"
        type="search"
        placeholder="Search services"
        aria-label="Search services"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          if (value) onChange('');
          else event.currentTarget.blur();
        }}
      />
      {value ? (
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm search-clear"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : (
        <kbd className="search-kbd" aria-hidden="true">
          /
        </kbd>
      )}
    </div>
  );
}
