import { useState, type ReactNode } from 'react';

export interface ImageWithFallbackProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  eager?: boolean;
}

/** Lazy-decoded WebP/GIF container with clean silent SVG fallback on load failure. */
export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallback = null,
  eager = false,
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
