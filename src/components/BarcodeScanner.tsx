import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface BarcodeScannerProps {
  onScanned: (barcode: string) => void;
  onClose: () => void;
}

const TIMEOUT_SECONDS = 15;

/**
 * Barcode Scanner Modal — powered by @zxing/browser.
 *
 * Architecture:
 *  - Mounts fresh each time → no stale state, unlimited reopens.
 *  - We own the <video> element directly → full styling control.
 *  - @zxing/browser continuously decodes from the video stream.
 *  - Idempotent cleanup via stoppedRef.
 *  - Auto-closes after TIMEOUT_SECONDS with no detection.
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScanned, onClose }) => {
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const readerRef   = useRef<any>(null);
  const detectorRef = useRef<any>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const detectionFrameRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const stoppedRef  = useRef(false);
  const onScannedRef = useRef(onScanned);
  const onCloseRef   = useRef(onClose);
  onScannedRef.current = onScanned;
  onCloseRef.current   = onClose;

  useEffect(() => {
    let unmounted = false;

    const doStop = () => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;

      // Stop the continuous decode loop
      if (readerRef.current) {
        try { readerRef.current.reset(); } catch (_) {}
        readerRef.current = null;
      }

      // Release the camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      // Cancel native detection loop
      if (detectionFrameRef.current !== null) {
        window.cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }

      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      // Clear the video element
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    // Countdown timer (created after video starts)
    let timer: ReturnType<typeof setInterval> | null = null;
    const detectorFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

    const startBarcodeDetector = async () => {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (!BarcodeDetectorClass) {
        return false;
      }

      try {
        const supportedFormats: string[] | undefined = await BarcodeDetectorClass.getSupportedFormats?.();
        const supported = !supportedFormats || detectorFormats.every(fmt => supportedFormats.includes(fmt));
        if (!supported) {
          console.log('[Scanner] BarcodeDetector available but missing required formats, falling back to ZXing');
          return false;
        }

        const detector = new BarcodeDetectorClass({ formats: detectorFormats });
        detectorRef.current = detector;
        console.log('[Scanner] Using BarcodeDetector');
        return true;
      } catch (err) {
        console.warn('[Scanner] BarcodeDetector init failed, falling back to ZXing', err);
        return false;
      }
    };

    const startZXing = async () => {
      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library')
      ]);

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150, tryPlayVideoTimeout: 3000 });
      readerRef.current = reader;
      console.log('[Scanner] Using ZXing fallback');
      return reader;
    };

    const runBarcodeDetectorLoop = async () => {
      if (stoppedRef.current || !videoRef.current || !detectorRef.current) return;
      try {
        const barcodes: any[] = await detectorRef.current.detect(videoRef.current);
        if (stoppedRef.current) return;
        if (barcodes && barcodes.length > 0) {
          const text = barcodes[0].rawValue;
          console.log('[Scanner] Detected:', text);
          if (timer) { clearInterval(timer); timer = null; }
          if (fallbackTimerRef.current !== null) {
            window.clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          doStop();
          setTimeout(() => onScannedRef.current(text), 50);
          return;
        }
      } catch (_) {
        // ignore detection failures and continue polling
      }
      detectionFrameRef.current = window.requestAnimationFrame(runBarcodeDetectorLoop);
    };

    const startScanner = async () => {
      try {
        const useNative = await startBarcodeDetector();
        if (!useNative) {
          await startZXing();
        }

        if (unmounted) return;

        // Acquire camera stream quickly; prefer environment/back camera and high-resolution
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          }
        };

        const startRequest = performance.now();
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (unmounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;

        const startStreamMs = Math.round(performance.now() - startRequest);
        console.log(`[Scanner] Camera acquired in ${startStreamMs}ms`);

        // Apply continuous autofocus if supported
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            const caps = videoTrack.getCapabilities?.() as any;
            if (caps?.focusMode?.includes('continuous')) {
              await videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
              console.log('[Scanner] Applied continuous focus');
            }
            if (caps?.width && caps?.height) {
              const idealW = Math.min(1920, caps.width.max ?? 1920);
              const idealH = Math.min(1080, caps.height.max ?? 1080);
              try {
                await videoTrack.applyConstraints({ width: idealW, height: idealH });
                console.log(`[Scanner] Applied resolution ${idealW}x${idealH}`);
              } catch (_) {}
            }
          } catch (_) {}
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          const playStart = performance.now();
          await videoRef.current.play();
          const playMs = Math.round(performance.now() - playStart);

          timer = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                doStop();
                if (!unmounted) onCloseRef.current();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

          if (detectorRef.current) {
            fallbackTimerRef.current = window.setTimeout(() => {
              console.log('[Scanner] No native detection within 2.5s; starting ZXing fallback');
              startZXing().then((reader) => {
                if (stoppedRef.current || !videoRef.current || !reader) return;
                reader.decodeFromVideoElement(videoRef.current, (result: any) => {
                  if (stoppedRef.current) return;
                  if (result) {
                    const text = result.getText();
                    console.log('[Scanner] Detected via ZXing fallback:', text);
                    if (timer) { clearInterval(timer); timer = null; }
                    doStop();
                    setTimeout(() => onScannedRef.current(text), 50);
                  }
                });
              }).catch((err) => {
                console.warn('[Scanner] ZXing fallback start failed', err);
              });
            }, 2500);
          }

          console.log(`[Scanner] Video started in ${playMs}ms — timer started`);
        }

        if (unmounted) { doStop(); return; }

        if (detectorRef.current) {
          runBarcodeDetectorLoop();
        } else if (readerRef.current) {
          readerRef.current.decodeFromVideoElement(
            videoRef.current!,
            (result: any) => {
              if (stoppedRef.current) return;
              if (result) {
                const text = result.getText();
                console.log('[Scanner] Detected:', text);
                if (timer) { clearInterval(timer); timer = null; }
                doStop();
                setTimeout(() => onScannedRef.current(text), 50);
              }
            }
          );
        }

        console.log('[Scanner] Ready — scanning for barcodes');
      } catch (err: any) {
        console.error('[Scanner] Start failed:', err?.message ?? err);
        if (timer) { clearInterval(timer); timer = null; }
        doStop();
        if (!unmounted) onCloseRef.current();
      }
    };

    startScanner();

    return () => {
      unmounted = true;
      clearInterval(timer);
      doStop();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="font-bold text-gray-800 text-base">Scan Barcode</span>
          <button
            onClick={() => onCloseRef.current()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera preview — we own this video element directly */}
        <div className="w-full bg-black" style={{ minHeight: 260 }}>
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            style={{
              width: '100%',
              height: '260px',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-end">
          <span className="text-xs font-bold text-gray-500">
            {timeLeft}s
          </span>
        </div>
      </div>
    </div>
  );
};
