// src/components/ImageLightbox.tsx — High-resolution image preview lightbox with zoom & download
import { useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';

interface ImageLightboxProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

export default function ImageLightbox({ imageUrl, imageName = 'Photo Preview', onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Top action bar */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '90vw',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fff',
          marginBottom: '14px',
          padding: '0 8px',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
          {imageName}
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href={imageUrl}
            download={imageName}
            className="btn btn-secondary btn-sm"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Download image"
            onClick={e => e.stopPropagation()}
          >
            <Download size={14} /> Download
          </a>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              border: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            title="Open original"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={14} /> Original
          </a>
          <button
            onClick={onClose}
            className="btn-icon-subtle"
            style={{
              color: '#fff',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image View */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '82vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 8,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        <img
          src={imageUrl}
          alt={imageName}
          style={{
            maxWidth: '100%',
            maxHeight: '82vh',
            objectFit: 'contain',
            borderRadius: 8,
          }}
        />
      </div>
    </div>
  );
}
