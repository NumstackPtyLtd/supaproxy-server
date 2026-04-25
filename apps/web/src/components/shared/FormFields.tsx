import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface FieldProps {
  label: string;
  help?: string;
  children: React.ReactNode;
}

export function Field({ label, help, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</label>
      {children}
      {help && <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{help}</p>}
    </div>
  );
}

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
  disabled?: boolean;
}

export function Input({ value, onChange, placeholder, type = 'text', mono = false, disabled = false }: InputProps) {
  return (
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      className={`w-full px-3 py-2 rounded-sm text-[13px] focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${mono ? 'font-mono' : ''}`}
      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }} />
  );
}

interface TextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: TextareaProps) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full px-3 py-2 rounded-sm text-[13px] focus:outline-none resize-none"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }} />
  );
}

interface SecretInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SecretInput({ value, onChange, placeholder }: SecretInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 rounded-sm text-[13px] font-mono focus:outline-none"
        style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

interface HFieldProps {
  label: string;
  help?: string;
  children: React.ReactNode;
}

export function HField({ label, help, children }: HFieldProps) {
  return (
    <div className="flex items-start justify-between px-5 py-3 last:border-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div className="pr-4">
        <label className="block text-[13px] font-medium" style={{ color: 'var(--text-heading)' }}>{label}</label>
        {help && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{help}</p>}
      </div>
      <div className="w-[280px] flex-shrink-0">{children}</div>
    </div>
  );
}
