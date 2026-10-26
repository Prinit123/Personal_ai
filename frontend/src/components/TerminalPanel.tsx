// src/components/TerminalPanel.tsx — Shows real-time terminal output
import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface TerminalPanelProps {
  lines: string[];
}

export default function TerminalPanel({ lines }: TerminalPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
        <Terminal size={13} className="text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Terminal Output</span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed">
        {lines.length === 0 && (
          <span className="text-[var(--text-muted)]">Terminal output will appear here when the AI runs commands...</span>
        )}
        {lines.map((line, i) => {
          const color =
            line.startsWith('[ERROR]')   ? 'text-red-400' :
            line.startsWith('[WARN]')    ? 'text-yellow-400' :
            line.startsWith('[SUCCESS]') ? 'text-green-400' :
            line.startsWith('[INFO]')    ? 'text-blue-400' :
            line.startsWith('$')        ? 'text-indigo-400' :
            'text-[var(--text-primary)]';
          return (
            <div key={i} className={`${color} whitespace-pre-wrap break-all`}>
              {line}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
