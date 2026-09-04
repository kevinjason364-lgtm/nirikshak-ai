'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { assessImageQuality } from '@/lib/image-quality';
import type { CapturedImage, ImageQualityResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

type ImageSlot = 'front' | 'back' | 'side-other';

interface CameraCaptureProps {
  images: CapturedImage[];
  onImagesChange: (images: CapturedImage[]) => void;
}

const slotLabels: Record<ImageSlot, string> = {
  front: 'Front Label',
  back: 'Back Label',
  'side-other': 'Side / Other',
};

export function CameraCapture({ images, onImagesChange }: CameraCaptureProps) {
  const [activeSlot, setActiveSlot] = useState<ImageSlot | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityResults, setQualityResults] = useState<Record<string, ImageQualityResult>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async (slot: ImageSlot) => {
    setActiveSlot(slot);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      setCameraError(
        'Camera access denied or unavailable. Please use the upload option instead.'
      );
      setCameraActive(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !activeSlot) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    await addImage(activeSlot, dataUrl);
    setActiveSlot(null);
  };

  const handleFileUpload = async (slot: ImageSlot, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      await addImage(slot, dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const addImage = async (slot: ImageSlot, dataUrl: string) => {
    const quality = await assessImageQuality(dataUrl);
    const id = uuidv4();

    const newImage: CapturedImage = {
      id,
      label: slot,
      dataUrl,
      blobKey: `img-${id}`,
      timestamp: Date.now(),
      qualityScore: quality.score,
      qualityWarnings: quality.warnings,
    };

    setQualityResults((prev) => ({ ...prev, [id]: quality }));

    // Replace existing image for this slot or add new
    const filtered = images.filter((img) => img.label !== slot);
    onImagesChange([...filtered, newImage]);
  };

  const removeImage = (slot: ImageSlot) => {
    onImagesChange(images.filter((img) => img.label !== slot));
  };

  const getImageForSlot = (slot: ImageSlot) => images.find((img) => img.label === slot);

  const qualityStatusBg = (status?: string) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-100 text-emerald-700';
      case 'needs-review':
        return 'bg-amber-100 text-amber-700';
      case 'retake-recommended':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const qualityStatusLabel = (status?: string) => {
    switch (status) {
      case 'good':
        return '✓ Good Quality';
      case 'needs-review':
        return '⚠ Needs Review';
      case 'retake-recommended':
        return '✗ Retake Recommended';
      default:
        return 'Not Assessed';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-navy-900">Label Images</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          Images used as visual evidence only — no automated interpretation
        </span>
      </div>

      {/* Camera view */}
      {cameraActive && (
        <Card className="overflow-hidden">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-80 object-contain"
            />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-center gap-4">
              <Button variant="secondary" size="lg" onClick={capturePhoto}>
                📸 Capture
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  stopCamera();
                  setActiveSlot(null);
                }}
                className="text-white border-white hover:bg-white/10"
              >
                Cancel
              </Button>
            </div>
          </div>
          <p className="text-xs text-center text-gray-500 mt-2">
            Capturing: {activeSlot ? slotLabels[activeSlot] : ''}
          </p>
        </Card>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {cameraError}
        </div>
      )}

      {/* Image slots */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['front', 'back', 'side-other'] as ImageSlot[]).map((slot) => {
          const img = getImageForSlot(slot);
          const quality = img ? qualityResults[img.id] : undefined;

          return (
            <Card key={slot} padding="sm" className="flex flex-col">
              <p className="text-sm font-medium text-gray-700 mb-2">{slotLabels[slot]}</p>

              {img ? (
                <div className="space-y-2">
                  <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={img.dataUrl}
                      alt={`${slotLabels[slot]} capture`}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Quality indicator */}
                  <div className={`text-xs px-2 py-1 rounded text-center ${qualityStatusBg(quality?.status)}`}>
                    {qualityStatusLabel(quality?.status)}
                  </div>

                  {quality?.warnings && quality.warnings.length > 0 && (
                    <ul className="text-xs text-amber-700 space-y-0.5">
                      {quality.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      fullWidth
                      onClick={() => startCamera(slot)}
                    >
                      Retake
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeImage(slot)}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <div className="text-3xl text-gray-300">📷</div>
                  <div className="flex flex-col gap-2 w-full px-3">
                    <Button size="sm" variant="primary" fullWidth onClick={() => startCamera(slot)}>
                      Camera
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      fullWidth
                      onClick={() => {
                        setActiveSlot(slot);
                        fileInputRef.current?.click();
                      }}
                    >
                      Upload
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && activeSlot) {
            handleFileUpload(activeSlot, file);
          }
          e.target.value = '';
        }}
      />
    </div>
  );
}
