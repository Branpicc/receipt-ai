"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getMyFirmId } from "@/lib/getFirmId";
import { getUserRole } from "@/lib/getUserRole";
import { useRouter } from "next/navigation";

export default function CameraCapturePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  // Add this after the existing useEffect
useEffect(() => {
  // Cleanup function to stop camera when component unmounts
  return () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };
}, [stream]);

  async function checkAccess() {
    try {
      const role = await getUserRole();
      setUserRole(role);

      if (role !== "client") {
        setError("Camera capture is only available for clients");
        setLoading(false);
        return;
      }

      setLoading(false);
      startCamera();
    } catch (err) {
      setError("Failed to verify access");
      setLoading(false);
    }
  }

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 1920, height: 1080 },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Failed to access camera. Please allow camera permissions.");
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedImage(imageDataUrl);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }

  function retake() {
    setCapturedImage(null);
    setError("");
    startCamera();
  }

async function uploadReceipt() {
  if (!capturedImage) return;

  try {
    setUploading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const firmId = await getMyFirmId();

    const { data: firmUser } = await supabase
      .from("firm_users")
      .select("id, client_id")
      .eq("auth_user_id", user.id)
      .eq("firm_id", firmId)
      .single();

    if (!firmUser?.client_id) throw new Error("Client not found");

    // Convert base64 to blob
    const base64Data = capturedImage.split(",")[1];
    const byteCharacters = atob(base64Data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: "image/jpeg" });
    const fileName = `receipt-${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: "image/jpeg" });

    // Use the same upload API as everything else
    const formData = new FormData();
    formData.append("file", file);
    formData.append("firmId", firmId);
    formData.append("clientId", firmUser.client_id);
    formData.append("userId", user.id);

    const response = await fetch("/api/upload-receipt", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Upload failed");

    alert("✅ Receipt uploaded successfully!");
    setCapturedImage(null);
    startCamera();
  } catch (err: any) {
    console.error("Upload error:", err);
    setError(err.message || "Failed to upload receipt");
  } finally {
    setUploading(false);
  }
}

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (error && userRole !== "client") {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-sm text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <h1 className="text-white text-lg font-semibold">📸 Capture Receipt</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-white text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Camera/Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4">
        {!capturedImage ? (
          // Camera View
          <div className="relative w-full max-w-2xl">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-xl"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {error && (
              <div className="absolute top-4 left-4 right-4 bg-red-500 text-white p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>
        ) : (
          // Preview
          <div className="w-full max-w-2xl">
            <img
              src={capturedImage}
              alt="Captured receipt"
              className="w-full rounded-xl mb-4"
            />
            <div className="bg-white rounded-xl p-4 mb-4">
              <p className="text-gray-900 font-medium text-center">
                Does the text look clear?
              </p>
              <p className="text-gray-600 text-sm text-center mt-1">
                Make sure all details are readable
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-800 p-4 space-y-3">
        {!capturedImage ? (
          <button
            onClick={capturePhoto}
            disabled={!stream}
            className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold text-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📸 Take Photo
          </button>
        ) : (
          <>
            <button
              onClick={uploadReceipt}
              disabled={uploading}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-semibold text-lg hover:bg-green-600 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "✅ Submit Receipt"}
            </button>
            <button
              onClick={retake}
              disabled={uploading}
              className="w-full py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 disabled:opacity-50"
            >
              🔄 Retake Photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}