import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src: string;
  /** 视频结束时触发（包含被跳过的情况） */
  onEnd: () => void;
  /** 是否允许跳过，默认允许 */
  skippable?: boolean;
  className?: string;
}

/**
 * 全屏视频播放器：支持点击暂停/继续，以及跳过。
 * 用于片头动画、剧情过场视频等场景。
 */
export default function VideoPlayer({ src, onEnd, skippable = true, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const endingTimerRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // 鼠标/触摸静止后隐藏控制提示
  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 2500);
    return () => clearTimeout(timer);
  }, [showControls]);

  // 浏览器通常会拦截带声音的自动播放：先尝试有声播放，
  // 被拦截则静音播放并提示用户手动开启声音
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (endingTimerRef.current !== null) {
      window.clearTimeout(endingTimerRef.current);
      endingTimerRef.current = null;
    }
    endedRef.current = false;
    setIsEnding(false);
    video.muted = false;
    setIsMuted(false);
    const playPromise = video.play();
    if (playPromise) {
      playPromise.catch(() => {
        video.muted = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    }
  }, [src]);

  useEffect(() => {
    return () => {
      if (endingTimerRef.current !== null) {
        window.clearTimeout(endingTimerRef.current);
      }
    };
  }, []);

  const finishNaturally = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setIsPaused(false);
    setShowControls(false);
    setIsEnding(true);
    endingTimerRef.current = window.setTimeout(() => {
      onEnd();
    }, 850);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video || isEnding) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    setShowControls(true);
  };

  const togglePause = () => {
    const video = videoRef.current;
    if (!video || isEnding) return;
    if (video.paused) {
      video.play();
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
    setShowControls(true);
  };

  const handleSkip = () => {
    endedRef.current = true;
    if (endingTimerRef.current !== null) {
      window.clearTimeout(endingTimerRef.current);
      endingTimerRef.current = null;
    }
    videoRef.current?.pause();
    onEnd();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={cn('fixed inset-0 z-[300] flex items-center justify-center bg-black', className)}
      onClick={togglePause}
      onMouseMove={() => !isEnding && setShowControls(true)}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        className="h-full w-full object-contain"
        onEnded={finishNaturally}
        onError={onEnd}
      />

      <AnimatePresence>
        {isEnding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 bg-black"
          />
        )}
      </AnimatePresence>

      {/* 暂停状态提示 */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="pointer-events-none absolute flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm"
          >
            <Play size={28} className="ml-1 text-white" fill="white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 顶部控制栏 */}
      <AnimatePresence>
        {showControls && !isEnding && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute left-0 right-0 top-0 flex items-center justify-between p-4"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePause();
              }}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full',
                'bg-black/40 text-white backdrop-blur-sm',
                'transition-colors hover:bg-black/60',
              )}
            >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  'bg-black/40 text-white backdrop-blur-sm',
                  'transition-colors hover:bg-black/60',
                  isMuted && 'text-amber-400',
                )}
              >
                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              {skippable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSkip();
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-4 py-2',
                    'bg-black/40 text-sm font-medium text-white backdrop-blur-sm',
                    'transition-colors hover:bg-black/60',
                  )}
                >
                  跳过
                  <SkipForward size={14} fill="currentColor" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
