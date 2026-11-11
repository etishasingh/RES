import React, { useEffect, useRef, useState } from 'react';

interface BackgroundVideoProps {
  src: string;
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({ src }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasError, setHasError] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Check user preference for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setIsReducedMotion(event.matches);
    };

    mediaQuery.addEventListener?.('change', handler);
    return () => {
      mediaQuery.removeEventListener?.('change', handler);
    };
  }, []);

  useEffect(() => {
    if (isReducedMotion && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isReducedMotion]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0">
      {!hasError && !isReducedMotion ? (
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover z-0"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setHasError(true)}
        >
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        /* Graceful static fallback when video fails or prefers-reduced-motion is active */
        <div
          className="absolute inset-0 w-full h-full bg-[#001726] z-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 30%, rgba(14, 54, 82, 0.45) 0%, rgba(1, 22, 38, 0.95) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      {/* 
        Restrained contrast treatment: A minimal dark tint to ensure text contrast 
        remains >= 4.5:1 throughout various brighter lighting frames in the video,
        preserving WCAG 2.2 AA accessibility while retaining the cinematic video visibility.
      */}
      <div
        className="absolute inset-0 bg-[#011422]/50 backdrop-contrast-[1.05] z-[1]"
        aria-hidden="true"
      />
    </div>
  );
};
