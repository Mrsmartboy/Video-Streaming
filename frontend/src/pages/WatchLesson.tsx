import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { API_COURSE_DETAILS } from '../constants/apiUrlConstants';
import { VideoPlayer } from '../components/VideoPlayer';
import { ArrowLeft, Play, Lock, Loader } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string;
  order: number;
  videoStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
}

interface CourseData {
  id: string;
  title: string;
  lessons: Lesson[];
}

export const WatchLesson: React.FC = () => {
  const { courseId, lessonId } = useParams();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    const fetchCourseAndLesson = async () => {
      try {
        const courseData = await apiFetch(API_COURSE_DETAILS(courseId!));
        setCourse(courseData);
        
        const activeLesson = courseData.lessons?.find((l: Lesson) => l.id === lessonId);
        if (!activeLesson) {
          throw new Error('Lesson not found in this course.');
        }
        
        setCurrentLesson(activeLesson);
      } catch (err: any) {
        setError(err.message || 'Error fetching stream data.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourseAndLesson();
  }, [courseId, lessonId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  if (error || !course || !currentLesson) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-4">{error || 'Lesson stream unavailable.'}</p>
          <Link to={`/courses/${courseId}`} className="text-violet-400 hover:underline text-xs flex items-center justify-center gap-1.5">
            <ArrowLeft size={14} /> Back to course details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col h-screen overflow-hidden">
      {/* Top Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur shrink-0 h-16 flex items-center">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/courses/${courseId}`}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition text-zinc-400 hover:text-white"
              title="Back to course curriculum"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="truncate">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Currently Watching</span>
              <span className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md block">{course.title}</span>
            </div>
          </div>

          <div className="text-xs text-zinc-400 hidden sm:block">
            Student: <span className="text-white font-bold ml-1">{user?.name}</span>
          </div>
        </div>
      </header>

      {/* Main split workspace */}
      <div className="flex-grow flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Video Player and Details */}
        <main className="flex-grow lg:w-3/4 p-6 overflow-y-auto flex flex-col gap-6">
          {currentLesson.videoStatus === 'READY' ? (
            <VideoPlayer lessonId={currentLesson.id} />
          ) : (
            <div className="w-full aspect-video bg-zinc-900/40 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-center p-8">
              <Loader className="animate-spin text-yellow-500" size={32} />
              <div className="font-bold text-sm">Video is currently processing...</div>
              <div className="text-xs text-zinc-500 max-w-sm">
                The BullMQ FFmpeg worker is generating adaptive HLS playlists and segments. This page will be ready for viewing shortly.
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-zinc-500 uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
                Lesson {currentLesson.order}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">{currentLesson.title}</h1>
            <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-4xl">{currentLesson.description}</p>
          </div>
        </main>

        {/* Right: Lessons Playlist Sidebar */}
        <aside className="w-full lg:w-1/4 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-zinc-900/10 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-zinc-900 shrink-0">
            <h3 className="font-bold text-xs text-zinc-400 uppercase tracking-widest">Course Syllabus</h3>
          </div>
          
          <div className="flex-grow overflow-y-auto p-4 space-y-2">
            {course.lessons.map((lesson) => {
              const isActive = lesson.id === lessonId;
              const isReady = lesson.videoStatus === 'READY';
              
              if (!isReady) {
                return (
                  <div
                    key={lesson.id}
                    className="w-full p-3 bg-zinc-950/20 border border-zinc-900/50 rounded-xl text-xs flex items-center justify-between text-zinc-550 opacity-60"
                  >
                    <div className="truncate pr-3">
                      <div className="font-medium truncate">{lesson.title}</div>
                      <div className="text-[9px] text-zinc-500 font-semibold uppercase mt-0.5">
                        Lesson {lesson.order} • {lesson.videoStatus.toLowerCase()}
                      </div>
                    </div>
                    <Lock size={12} className="shrink-0" />
                  </div>
                );
              }

              return (
                <Link
                  key={lesson.id}
                  to={`/courses/${courseId}/lessons/${lesson.id}`}
                  className={`w-full p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                    isActive
                      ? 'bg-violet-600/15 border-violet-500 text-white font-semibold'
                      : 'bg-zinc-900/30 border-zinc-850 hover:bg-zinc-800/40 text-zinc-300'
                  }`}
                >
                  <div className="truncate pr-3">
                    <div className="font-medium truncate">{lesson.title}</div>
                    <div className="text-[9px] text-zinc-500 font-semibold uppercase mt-0.5">
                      Lesson {lesson.order}
                    </div>
                  </div>
                  <Play size={10} className={`shrink-0 ${isActive ? 'text-violet-400' : 'text-zinc-500'}`} fill="currentColor" />
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
};
