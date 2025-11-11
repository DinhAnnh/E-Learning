import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface VideoPlayerProps {
  videoUrl: string;
  videoId: string;
  initialWatchTime?: number;
  onProgressUpdate: (watchTime: number) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoId,
  initialWatchTime = 0,
  onProgressUpdate,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [watchTime, setWatchTime] = useState(initialWatchTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTabVisible, setIsTabVisible] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // Track tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsTabVisible(isVisible);

      if (!isVisible && videoRef.current && !videoRef.current.paused) {
        // Tab is hidden and video is playing - pause it
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Track watch time
  useEffect(() => {
    if (isPlaying && isTabVisible) {
      intervalRef.current = window.setInterval(() => {
        setWatchTime((prev) => {
          const newTime = prev + 1;
          onProgressUpdate(newTime);
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isTabVisible, onProgressUpdate]);

  useEffect(() => {
    setWatchTime(initialWatchTime);
    const videoEl = videoRef.current;
    if (!videoEl) {
      return;
    }

    const applyInitialTime = () => {
      try {
        videoEl.currentTime = initialWatchTime;
      } catch (error) {
        console.warn('Không thể cập nhật thời gian bắt đầu của video', error);
      }
    };

    if (videoEl.readyState >= 1) {
      applyInitialTime();
    } else {
      const onLoadedMetadata = () => {
        applyInitialTime();
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
      videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
      return () => {
        videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      };
    }
  }, [initialWatchTime, videoId]);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
    onProgressUpdate(watchTime);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    const duration = videoRef.current?.duration ?? watchTime;
    onProgressUpdate(Math.ceil(duration));
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div 
      className="relative w-full rounded-2xl overflow-hidden shadow-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full aspect-video bg-black"
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        controlsList="nodownload"
      />

      {/* Watch time overlay */}
      <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm font-semibold shadow-lg">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Thời gian học: {formatTime(watchTime)}</span>
        </div>
      </div>

      {/* Tab visibility warning */}
      {!isTabVisible && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-10">
          <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Video đã tạm dừng</h3>
            <p className="text-gray-600">
              Bạn đã chuyển sang tab khác. Hãy quay lại để tiếp tục học!
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
