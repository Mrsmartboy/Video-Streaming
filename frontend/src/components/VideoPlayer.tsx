import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Settings, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_VIDEO_PLAYBACK_TOKEN } from '../constants/apiUrlConstants';

interface VideoPlayerProps {
  lessonId: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ lessonId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { user } = useAuth();

  // Playback Auth States
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [playbackToken, setPlaybackToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quality Selector States
  const [levels, setLevels] = useState<{ id: number; name: string }[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);

  // Watermark States
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });
  const [watermarkTime, setWatermarkTime] = useState('');

  // 1. Fetch playback token + stream URL
  useEffect(() => {
    let active = true;
    const fetchToken = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem('token');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${apiUrl}${API_VIDEO_PLAYBACK_TOKEN(lessonId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to authenticate playback.');
        }

        const data = await response.json();
        if (active) {
          setPlaybackToken(data.playbackToken);
          setStreamUrl(data.streamUrl);
        }
      } catch (err: any) {
        if (active) {
          console.error('[VideoPlayer] Token fetch error:', err);
          setError(err.message || 'Could not load video player authorization.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchToken();
    return () => { active = false; };
  }, [lessonId]);

  // 2. Live clock for watermark
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      setWatermarkTime(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // 3. Moving watermark position
  useEffect(() => {
    const move = () => setWatermarkPos({
      top: `${Math.floor(Math.random() * 70) + 10}%`,
      left: `${Math.floor(Math.random() * 60) + 10}%`,
    });
    move();
    const id = setInterval(move, 8000);
    return () => clearInterval(id);
  }, []);

  // 4. Prevent DevTools shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F12') { e.preventDefault(); return; }
      if (e.ctrlKey && e.shiftKey && ['I','J','C','i','j','c'].includes(e.key)) { e.preventDefault(); return; }
      if (e.ctrlKey && ['U','u','S','s'].includes(e.key)) { e.preventDefault(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 5. Initialize HLS.js
  useEffect(() => {
    if (!streamUrl || !playbackToken) return;
    const video = videoRef.current;
    if (!video) return;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

    // Destroy any existing instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Inject playback token on every request to our backend
        xhrSetup: (xhr, url) => {
          if (url.startsWith(apiUrl)) {
            xhr.setRequestHeader('X-Playback-Token', playbackToken);
          }
        },
        // For AES-128 key requests, also send the token
        fetchSetup: (context, initParams) => {
          if (context.url.startsWith(apiUrl)) {
            (initParams.headers as Record<string, string>)['X-Playback-Token'] = playbackToken;
          }
          return new Request(context.url, initParams);
        },
        enableWorker: true,
        lowLatencyMode: false,
        startLevel: -1, // Auto quality by default
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        console.log('[HLS] Manifest parsed, levels:', data.levels.length);

        // Build quality levels list
        const qualityList = data.levels.map((level, index) => ({
          id: index,
          name: `${level.height}p (${Math.round((level.bitrate || 0) / 1000)}kbps)`,
        }));
        setLevels([{ id: -1, name: 'Auto' }, ...qualityList.reverse()]); // highest first
        video.play().catch(() => {/* autoplay may be blocked */});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[HLS] Error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error loading video stream. Please check your connection.');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('A fatal error occurred loading the video.');
              hls.destroy();
          }
        }
      });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = streamUrl;
      video.play().catch(() => {});
    } else {
      setError('Your browser does not support HLS video playback.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, playbackToken, lessonId]);

  const changeQuality = (levelId: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelId; // -1 = auto
      setCurrentLevel(levelId);
    }
    setShowSettings(false);
  };

  if (loading) {
    return (
      <div className="w-full bg-zinc-950 aspect-video rounded-xl border border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-4 text-zinc-400">
        <Loader2 className="animate-spin text-violet-500" size={40} />
        <p className="text-sm font-medium animate-pulse font-sans">Loading HLS stream...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-zinc-950 aspect-video rounded-xl border border-zinc-800 shadow-2xl flex flex-col items-center justify-center gap-3 p-6 text-center text-zinc-400">
        <AlertTriangle className="text-red-500" size={44} />
        <h4 className="text-white font-semibold text-lg font-sans">Stream Error</h4>
        <p className="text-xs max-w-sm text-zinc-500 leading-relaxed font-sans">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative group w-full bg-black aspect-video rounded-xl overflow-hidden shadow-2xl border border-zinc-800 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Dynamic Floating Watermark */}
      {user && (
        <div
          className="absolute pointer-events-none select-none z-10 transition-all duration-1000 ease-in-out font-mono font-bold tracking-wider"
          style={{ top: watermarkPos.top, left: watermarkPos.left, transform: 'translate(-50%, -50%)' }}
        >
          <div className="text-[10px] sm:text-xs md:text-sm text-white/10 bg-black/10 border border-white/5 px-3 py-1.5 rounded-md backdrop-blur-[0.5px]">
            <div>{user.email}</div>
            <div className="text-[8px] sm:text-[10px] text-white/5 text-right font-normal">
              ID: {user.id.slice(0, 8)}... • {watermarkTime}
            </div>
          </div>
        </div>
      )}

      {/* Quality Selector */}
      {levels.length > 0 && (
        <div className="absolute bottom-16 right-4 z-20">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 bg-zinc-900/90 text-white rounded-full border border-zinc-700/80 shadow-lg hover:bg-violet-600 transition"
            title="Quality Settings"
          >
            <Settings size={18} />
          </button>

          {showSettings && (
            <div className="absolute bottom-12 right-0 bg-zinc-950/95 border border-zinc-800 rounded-lg p-2 shadow-2xl min-w-36 flex flex-col gap-1">
              <div className="text-[10px] text-zinc-500 px-2 py-1 font-semibold uppercase tracking-wider font-sans">Quality</div>
              {levels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => changeQuality(level.id)}
                  className={`w-full text-left px-3 py-1.5 rounded text-xs transition font-medium font-sans ${
                    currentLevel === level.id
                      ? 'bg-violet-600/90 text-white'
                      : 'text-zinc-300 hover:bg-zinc-800/80'
                  }`}
                >
                  {level.name}
                  {level.id === -1 && (
                    <span className="text-[10px] text-zinc-400 block font-normal">(Adaptive)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
