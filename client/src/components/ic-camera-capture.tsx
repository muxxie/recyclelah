import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Camera, RotateCcw, Check, X } from "lucide-react";

interface ICCameraCaptureProps {
  label: string;
  value: string;
  onChange: (base64: string) => void;
  testId: string;
}

export function ICCameraCapture({ label, value, onChange, testId }: ICCameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string>(value || "");
  const [cameraError, setCameraError] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  useEffect(() => {
    if (value && !capturedImage) {
      setCapturedImage(value);
    }
  }, [value]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
    } catch (err: any) {
      setCameraError("Could not access camera. Please allow camera permissions and try again.");
      setIsCameraOpen(false);
    }
  }, [facingMode, stopCamera]);

  const switchCamera = useCallback(() => {
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
  }, [facingMode]);

  useEffect(() => {
    if (isCameraOpen) {
      startCamera();
    }
  }, [facingMode]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(dataUrl);
    onChange(dataUrl);
    stopCamera();
    setIsCameraOpen(false);
  }, [onChange, stopCamera]);

  const retake = useCallback(() => {
    setCapturedImage("");
    onChange("");
    startCamera();
  }, [onChange, startCamera]);

  const cancelCamera = useCallback(() => {
    stopCamera();
    setIsCameraOpen(false);
  }, [stopCamera]);

  if (capturedImage) {
    return (
      <div data-testid={testId}>
        <p className="text-sm font-medium mb-2">{label}</p>
        <Card className="overflow-visible relative">
          <img
            src={capturedImage}
            alt={label}
            className="w-full h-40 object-cover rounded-md"
            data-testid={`${testId}-preview`}
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <Button size="icon" variant="secondary" onClick={retake} data-testid={`${testId}-retake`}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute bottom-2 left-2">
            <div className="flex items-center gap-1 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
              <Check className="w-3 h-3" /> Captured
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div data-testid={testId}>
        <p className="text-sm font-medium mb-2">{label}</p>
        <Card className="overflow-visible relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-48 object-cover rounded-md bg-black"
            data-testid={`${testId}-video`}
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
            <Button size="icon" variant="secondary" onClick={cancelCamera} data-testid={`${testId}-cancel`}>
              <X className="w-4 h-4" />
            </Button>
            <Button
              onClick={capturePhoto}
              className="w-14 h-14 rounded-full bg-white border-4 border-green-500"
              data-testid={`${testId}-capture`}
            >
              <div className="w-10 h-10 rounded-full bg-green-500" />
            </Button>
            <Button size="icon" variant="secondary" onClick={switchCamera} data-testid={`${testId}-switch`}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            Position your IC card within the frame
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid={testId}>
      <p className="text-sm font-medium mb-2">{label}</p>
      <Card
        className="flex flex-col items-center justify-center gap-2 p-6 border-dashed cursor-pointer hover-elevate"
        onClick={() => startCamera()}
      >
        <Camera className="w-8 h-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Tap to open camera</span>
        {cameraError && (
          <p className="text-xs text-destructive text-center mt-1">{cameraError}</p>
        )}
      </Card>
    </div>
  );
}
