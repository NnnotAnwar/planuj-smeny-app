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
        className={`absolute w-3.5 h-3.5 text-gray-400 ${iconClassName || 'left-2.5 top-1/2 -translate-y-1/2'}`}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/40 py-2 pl-8 pr-3 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500/40 shadow-sm transition-all ${inputClassName}`}
      />
    </div>
  );
}
