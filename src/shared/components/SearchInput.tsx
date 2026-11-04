import { MagnifyingGlassIcon } from '@phosphor-icons/react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  iconClassName?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = '',
  className = '',
  inputClassName = '',
  iconClassName = '',
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlassIcon
        weight="bold"
        className={`absolute size-3.5 text-ink-soft/70 dark:text-slate-500 ${iconClassName || 'left-2.5 top-1/2 -translate-y-1/2'}`}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-ink/10 bg-white/70 py-1.5 pl-8 pr-3 text-meta text-ink outline-none transition-all placeholder:text-ink-soft/70 focus:border-emerald-500/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-white/8 ${inputClassName}`}
      />
    </div>
  );
}
