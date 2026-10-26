import { Wifi, WifiOff, Cpu, Globe } from 'lucide-react';
import type { SystemStatus } from '../types';

interface StatusBarProps {
  status: SystemStatus | null;
  provider: string;
  model: string;
}

export default function StatusBar({ status, provider, model }: StatusBarProps) {
  const ollamaOk  = status?.ollama === 'online';
  const internetOk = status?.internet === 'online';
  const geminiOk  = status?.gemini === 'configured';

  return (
    <div className="status-bar">
      {/* Backend */}
      <div className="item">
        <span className={`status-dot ${status ? 'ok' : 'loading'}`} />
        <span>Backend</span>
      </div>

      {/* Ollama */}
      <div className="item">
        <Cpu size={10} />
        <span className={`status-dot ${ollamaOk ? 'ok' : 'error'}`} />
        <span>Ollama: {ollamaOk ? 'Online' : 'Offline'}</span>
      </div>

      {/* Gemini */}
      <div className="item">
        <span className={`status-dot ${geminiOk ? 'ok' : 'warning'}`} />
        <span>Gemini: {geminiOk ? 'Ready' : 'Not configured'}</span>
      </div>

      {/* Internet */}
      <div className="item">
        {internetOk ? <Wifi size={10} /> : <WifiOff size={10} />}
        <span>{internetOk ? 'Online' : 'Offline'}</span>
      </div>

      {/* Current model */}
      <div className="item" style={{ marginLeft: 'auto' }}>
        <Globe size={10} />
        <span style={{ color: 'var(--accent-light)' }}>{provider} / {model.split(':')[0]}</span>
      </div>

      {status && (
        <div className="item">
          <span>Uptime: {Math.floor(status.uptime / 60)}m</span>
        </div>
      )}
    </div>
  );
}
