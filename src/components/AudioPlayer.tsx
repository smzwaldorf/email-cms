/**
 * 音訊播放器元件 - HTML5 音訊播放與控制
 * Audio Player Component - HTML5 audio playback and controls
 */

import React, { useRef, useState, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

/**
 * 音訊播放器元件屬性
 * Audio Player component props
 */
interface AudioPlayerProps {
  src: string
  title?: string
  duration?: number
  className?: string
  onDurationChange?: (duration: number) => void
  onEnded?: () => void
}

/**
 * 格式化時間為 MM:SS
 * Format time as MM:SS
 */
const formatTime = (seconds: number | undefined): string => {
  if (!seconds || isNaN(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * 音訊播放器元件
 * Audio Player component
 *
 * 功能:
 * - 播放/暫停控制
 * - 進度條拖曳
 * - 音量控制
 * - 時間顯示
 * - 響應式設計
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  duration: initialDuration,
  className = '',
  onDurationChange,
  onEnded,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(initialDuration || 0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 更新音訊參考
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadStart = () => setIsLoading(true)
    const handleLoadedMetadata = () => {
      setIsLoading(false)
      setDuration(audio.duration)
      onDurationChange?.(audio.duration)
    }
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleEnded = () => {
      setIsPlaying(false)
      onEnded?.()
    }
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [onDurationChange, onEnded])

  // 應用音量設定
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play().catch((err) => {
          console.error('播放失敗 / Playback failed:', err)
        })
      }
    }
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    setIsMuted(false)
  }

  const handleToggleMute = () => {
    setIsMuted(!isMuted)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={`
        w-full bg-gradient-to-r from-gray-50 to-gray-100
        rounded-lg border border-gray-200 shadow-sm p-4
        ${className}
      `}
      data-testid="audio-player"
    >
      <audio
        ref={audioRef}
        src={src}
        crossOrigin="anonymous"
        preload="metadata"
        className="hidden"
      />

      {/* 標題 */}
      {title && (
        <p className="text-sm font-medium text-gray-800 mb-3 truncate">
          {title}
        </p>
      )}

      {/* 進度條 */}
      <div className="mb-3">
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleProgressChange}
          className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
          data-testid="audio-progress"
          disabled={isLoading || duration === 0}
        />
      </div>

      {/* 時間顯示和控制按鈕 */}
      <div className="flex items-center justify-between gap-3">
        {/* 播放/暫停按鈕 */}
        <button
          type="button"
          onClick={handlePlayPause}
          disabled={isLoading || duration === 0}
          className={`
            flex items-center justify-center w-10 h-10 rounded-full
            transition-colors flex-shrink-0
            ${
              isLoading || duration === 0
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : isPlaying
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            }
          `}
          title={isPlaying ? '暫停 / Pause' : '播放 / Play'}
          data-testid="audio-play-button"
        >
          {isPlaying ? (
            <Pause size={20} className="fill-current" />
          ) : (
            <Play size={20} className="fill-current ml-0.5" />
          )}
        </button>

        {/* 時間顯示 */}
        <div className="text-xs font-medium text-gray-600 min-w-fit">
          <span data-testid="current-time">{formatTime(currentTime)}</span>
          <span className="mx-1">/</span>
          <span data-testid="duration">{formatTime(duration)}</span>
        </div>

        {/* 音量控制 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
            title={isMuted ? '取消靜音 / Unmute' : '靜音 / Mute'}
            data-testid="audio-mute-button"
          >
            {isMuted ? (
              <VolumeX size={18} className="text-gray-500" />
            ) : (
              <Volume2 size={18} className="text-gray-500" />
            )}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-500"
            data-testid="audio-volume"
          />
        </div>
      </div>

      {/* 載入狀態 */}
      {isLoading && (
        <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3 h-3 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin" />
          <span>載入中 / Loading</span>
        </div>
      )}
    </div>
  )
}

export default AudioPlayer
