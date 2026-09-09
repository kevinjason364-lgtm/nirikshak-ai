'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { assessImageQuality } from '@/lib/image-quality';
import type { CapturedImage, ImageQualityResult } from '@/types';
import { v4 as uuidv4 } from 'uuid';

const MAX_IMAGES = 10;

interface CameraCaptureProps {
  images: CapturedImage[];
  onImagesChange: (images: CapturedImage[]) => void;
}

export function CameraCapture({ images, onImagesChange }: CameraCaptureProps) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [qualityResults, setQualityResults] = useState<Record<string, ImageQualityResult>>({});
  const [isUploading, setIsUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetIdRef = useRef<string | null>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);

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

  // Initial quality assessment for loaded images if needed
  useEffect(() => {
    images.forEach(async (img) => {
      if (!qualityResults[img.id] && img.dataUrl) {
        const quality = await assessImageQuality(img.dataUrl);
        setQualityResults((prev) => ({ ...prev, [img.id]: quality }));
      }
    });
  }, [images, qualityResults]);

  const startCamera = async () => {
    if (images.length >= MAX_IMAGES) return;

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
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    stopCamera();
    await addNewImage(dataUrl);
  };

  const addNewImage = async (dataUrl: string) => {
    if (images.length >= MAX_IMAGES) return;

    const quality = await assessImageQuality(dataUrl);
    const id = uuidv4();

    const newImage: CapturedImage = {
      id,
      dataUrl,
      blobKey: `img-${id}`,
      timestamp: Date.now(),
      qualityScore: quality.score,
      qualityWarnings: quality.warnings,
      _internalIndex: images.length,
    };

    setQualityResults((prev) => ({ ...prev, [id]: quality }));
    onImagesChange([...images, newImage]);
  };

  const updateImageData = async (id: string, dataUrl: string) => {
    const quality = await assessImageQuality(dataUrl);
    setQualityResults((prev) => ({ ...prev, [id]: quality }));

    const updated = images.map((img) => {
      if (img.id === id) {
        return {
          ...img,
          dataUrl,
          timestamp: Date.now(),
          qualityScore: quality.score,
          qualityWarnings: quality.warnings,
        };
      }
      return img;
    });

    onImagesChange(updated);
  };

  const removeImage = (id: string) => {
    const filtered = images.filter((img) => img.id !== id);
    // Reindex remaining images
    const reindexed = filtered.map((img, idx) => ({
      ...img,
      _internalIndex: idx,
    }));
    onImagesChange(reindexed);
  };

  const handleSingleFileUpload = (id: string) => {
    replaceTargetIdRef.current = id;
    if (singleFileInputRef.current) {
      singleFileInputRef.current.value = '';
      singleFileInputRef.current.click();
    }
  };

  const handleSingleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replaceTargetIdRef.current;
    if (file && targetId) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          await updateImageData(targetId, dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const availableSlots = MAX_IMAGES - images.length;
    const filesToProcess = Array.from(files).slice(0, availableSlots);

    const newCapturedList: CapturedImage[] = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.readAsDataURL(file);
      });

      if (!dataUrl) continue;

      const quality = await assessImageQuality(dataUrl);
      const id = uuidv4();

      newCapturedList.push({
        id,
        dataUrl,
        blobKey: `img-${id}`,
        timestamp: Date.now(),
        qualityScore: quality.score,
        qualityWarnings: quality.warnings,
        _internalIndex: images.length + i,
      });

      setQualityResults((prev) => ({ ...prev, [id]: quality }));
    }

    onImagesChange([...images, ...newCapturedList]);
    setIsUploading(false);
    e.target.value = '';
  };

  const qualityStatusBg = (status?: string) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'needs-review':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'retake-recommended':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
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
        return 'Assessing Quality...';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-navy-900">Package Images</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-navy-100 text-navy-800">
              {images.length} / {MAX_IMAGES}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Upload or capture package photos. The AI will automatically extract information from all images.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {images.length < MAX_IMAGES && (
            <>
              <Button
                variant="primary"
                size="sm"
                onClick={() => startCamera()}
                disabled={cameraActive || isUploading}
                className="flex items-center gap-1.5"
              >
                📸 Add via Camera
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (multiFileInputRef.current) {
                    multiFileInputRef.current.value = '';
                    multiFileInputRef.current.click();
                  }
                }}
                disabled={cameraActive || isUploading}
                className="flex items-center gap-1.5"
              >
                📁 Upload Images
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Camera Live View Modal / Panel */}
      {cameraActive && (
        <Card className="overflow-hidden border-2 border-navy-500 shadow-lg">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-80 sm:max-h-96 object-contain"
            />
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center gap-3">
              <div className="flex items-center gap-4">
                <Button variant="secondary" size="lg" onClick={capturePhoto} className="shadow-md">
                  📸 Capture Frame
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    stopCamera();
                  }}
                  className="text-white border-white hover:bg-white/10"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-center text-gray-500 mt-2">
            Capturing image {images.length + 1}
          </p>
        </Card>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{cameraError}</span>
          <Button size="sm" variant="ghost" onClick={() => setCameraError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Image Cards Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => {
            const quality = qualityResults[img.id];

            return (
              <Card key={img.id} padding="sm" className="flex flex-col relative group border hover:border-navy-300 transition-all">
                {/* Image index badge */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-navy-800 bg-gray-100 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                </div>

                {/* Thumbnail */}
                <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                  <img
                    src={img.dataUrl}
                    alt={`Package image ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Quality indicator */}
                <div className="mt-2 space-y-1">
                  <div
                    className={`text-[11px] px-2 py-0.5 rounded border text-center font-medium ${qualityStatusBg(
                      quality?.status
                    )}`}
                  >
                    {qualityStatusLabel(quality?.status)}
                    {quality?.score !== undefined ? ` (${quality.score}%)` : ''}
                  </div>

                  {quality?.warnings && quality.warnings.length > 0 && (
                    <ul className="text-[10px] text-amber-700 space-y-0.5 bg-amber-50/60 p-1.5 rounded border border-amber-150">
                      {quality.warnings.map((w, i) => (
                        <li key={i}>⚠ {w}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs py-1"
                    onClick={() => startCamera()}
                    title="Retake photo using camera"
                  >
                    📷 Retake
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs py-1"
                    onClick={() => handleSingleFileUpload(img.id)}
                    title="Replace with an uploaded file"
                  >
                    📁 Replace
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeImage(img.id)}
                    className="text-red-600 hover:bg-red-50 px-2 text-xs py-1"
                    title="Remove this image"
                  >
                    ✕
                  </Button>
                </div>
              </Card>
            );
          })}

          {/* Add more placeholder card if count < MAX_IMAGES */}
          {images.length < MAX_IMAGES && (
            <Card
              padding="sm"
              className="flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors"
            >
              <div className="text-3xl text-gray-400">➕</div>
              <p className="text-xs font-medium text-gray-600 text-center">
                Add More Images ({images.length}/{MAX_IMAGES})
              </p>
              <div className="flex flex-col gap-1.5 w-full">
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  onClick={() => startCamera()}
                  disabled={cameraActive}
                >
                  📷 Camera
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    if (multiFileInputRef.current) {
                      multiFileInputRef.current.value = '';
                      multiFileInputRef.current.click();
                    }
                  }}
                  disabled={cameraActive}
                >
                  📁 Upload
                </Button>
              </div>
            </Card>
          )}
        </div>
      ) : (
        /* Empty State */
        <Card className="flex flex-col items-center justify-center p-8 sm:p-12 text-center border-2 border-dashed border-gray-300 rounded-2xl bg-gray-50/60">
          <div className="w-16 h-16 rounded-full bg-navy-100 flex items-center justify-center text-3xl mb-4 text-navy-800">
            📦
          </div>
          <h4 className="text-base font-semibold text-navy-900 mb-1">
            No Package Images Yet
          </h4>
          <p className="text-sm text-gray-500 max-w-md mb-6">
            Upload or capture multiple photos of your product package. The AI will automatically analyze all images and extract required information.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => startCamera()}
              className="flex items-center gap-2 shadow-sm"
            >
              📷 Open Camera
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (multiFileInputRef.current) {
                  multiFileInputRef.current.value = '';
                  multiFileInputRef.current.click();
                }
              }}
              className="flex items-center gap-2"
            >
              📁 Upload Image Files
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Supports multi-file selection (PNG, JPG, WebP up to 5MB each). Maximum 10 images.
          </p>
        </Card>
      )}

      {/* Hidden Multi-file input */}
      <input
        ref={multiFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleMultiFileUpload}
      />

      {/* Hidden Single-file replace input */}
      <input
        ref={singleFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSingleFileChange}
      />
    </div>
  );
}
