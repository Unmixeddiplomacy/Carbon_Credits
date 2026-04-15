import { useState, useRef, useCallback, useEffect } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";

/**
 * TreeVerificationCapture - Captures photo and GPS for tree verification
 * 
 * Usage:
 * <TreeVerificationCapture 
 *   treeId={123}
 *   treeName="My Oak Tree"
 *   onSubmit={async (data) => { ... }}
 *   onCancel={() => { ... }}
 * />
 */
const TreeVerificationCapture = ({ 
  treeId, 
  treeName = "Tree",
  verificationType = "periodic",
  onSubmit, 
  onCancel,
  isDeathReport = false 
}) => {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [notes, setNotes] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Death date for death reports (defaults to today)
  const [deathDate, setDeathDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (stream && videoRef.current && showCamera) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.error("Video play error:", err);
      });
    }
    
    // Cleanup on unmount
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream, showCamera]);

  // Get current GPS location
  const getLocation = useCallback(() => {
    setIsGettingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsGettingLocation(false);
      },
      (error) => {
        let message = "Unable to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location information unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
        }
        setLocationError(message);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, []);

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processPhoto(file);
    }
  };

  // Process photo file
  const processPhoto = (file) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10MB");
      return;
    }

    setPhoto(file);
    setError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Auto-get location when photo is taken
    if (!location) {
      getLocation();
    }
  };

  // Start camera for direct capture
  const startCamera = async () => {
    try {
      setError(null);
      // First show the camera UI so the video element is rendered
      setShowCamera(true);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Prefer rear camera
        audio: false,
      });
      setStream(mediaStream);
      
      // Use setTimeout to ensure video element is mounted before attaching stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err) {
      console.error("Camera error:", err);
      setShowCamera(false);
      // Fallback to file input for mobile
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        setError("Unable to access camera. Please check permissions.");
      }
    }
  };

  // Take photo from camera
  const captureFromCamera = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      const file = new File([blob], `tree-verification-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      processPhoto(file);
      stopCamera();
    }, "image/jpeg", 0.8);
  };

  // Stop camera stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setShowCamera(false);
  };

  // Submit verification
  const handleSubmit = async () => {
    if (!photo) {
      setError("Please take or upload a photo");
      return;
    }

    if (!location) {
      setError("Please enable location access");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // For demo, we'll create a data URL
      // In production, upload to cloud storage and use the URL
      const photoUrl = photoPreview; // Would be cloud storage URL in production

      await onSubmit({
        treeId,
        photoUrl,
        latitude: location.latitude,
        longitude: location.longitude,
        verificationType: isDeathReport ? "death_report" : verificationType,
        notes,
        ...(isDeathReport && { deathDate }),
        deviceInfo: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          accuracy: location.accuracy,
        },
      });
    } catch (err) {
      setError(err.message || "Failed to submit verification");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cleanup on unmount
  const handleCancel = () => {
    stopCamera();
    onCancel?.();
  };

  return (
    <Card className={isDeathReport ? "border-red-200 bg-red-50" : ""}>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-neutral-200 pb-4">
          <h3 className={`text-lg font-semibold ${isDeathReport ? "text-red-800" : "text-neutral-800"}`}>
            {isDeathReport ? "Report Dead Tree" : "Verify Tree"}
          </h3>
          <p className="text-sm text-neutral-600 mt-1">
            {isDeathReport 
              ? `Confirm that "${treeName}" is no longer alive`
              : `Take a current photo of "${treeName}" to verify its health`
            }
          </p>
        </div>

        {/* Camera / Photo Section */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-neutral-700">
            Photo Evidence *
          </label>

          {showCamera ? (
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => e.target.play()}
                className="w-full rounded-lg bg-black min-h-[300px]"
              />
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button onClick={captureFromCamera} className="bg-emerald-600">
                  Capture
                </Button>
                <Button onClick={stopCamera} variant="secondary">
                  Cancel
                </Button>
              </div>
            </div>
          ) : photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-lg border border-neutral-200"
              />
              <button
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
                className="absolute top-2 right-2 bg-white/80 text-neutral-600 hover:text-red-600 rounded-full p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button onClick={startCamera} variant="secondary" className="w-full">
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Take Photo with Camera
                </span>
              </Button>
              <p className="text-xs text-neutral-500 text-center">
                📷 Live camera capture required for secure verification
              </p>
              {/* Hidden file input for mobile camera fallback */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Location Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">
            GPS Location *
          </label>
          
          {location ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                {location.accuracy && (
                  <span className="text-neutral-500 ml-2">
                    (±{Math.round(location.accuracy)}m)
                  </span>
                )}
              </span>
              <button
                onClick={getLocation}
                className="ml-auto text-emerald-600 hover:text-emerald-800"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div>
              <Button 
                onClick={getLocation} 
                variant="secondary" 
                disabled={isGettingLocation}
                className="w-full"
              >
                {isGettingLocation ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Getting location...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    Enable Location
                  </span>
                )}
              </Button>
              {locationError && (
                <p className="mt-2 text-sm text-red-600">{locationError}</p>
              )}
            </div>
          )}
        </div>

        {/* Death Date Section (only for death reports) */}
        {isDeathReport && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-red-700">
              When did the tree die? *
            </label>
            <input
              type="date"
              value={deathDate}
              onChange={(e) => setDeathDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
            />
            <p className="text-xs text-red-600">
              ⚠️ Credits issued after this date will be automatically deducted
            </p>
          </div>
        )}

        {/* Notes Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">
            Notes {isDeathReport && "(describe condition)"}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isDeathReport 
              ? "Describe what happened to the tree..."
              : "Any observations about the tree's condition..."
            }
            rows={3}
            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t border-neutral-200">
          <Button
            onClick={handleCancel}
            variant="secondary"
            disabled={isSubmitting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!photo || !location || isSubmitting}
            className={`flex-1 ${isDeathReport ? "bg-red-600 hover:bg-red-700" : ""}`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Submitting...
              </span>
            ) : isDeathReport ? (
              "Confirm Tree Death"
            ) : (
              "Submit Verification"
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default TreeVerificationCapture;
