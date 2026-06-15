import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { API_COURSE_DETAILS, API_COURSE_ENROLL } from '../constants/apiUrlConstants';
import { ArrowLeft, Play, Lock, Sparkles, CheckCircle, Loader } from 'lucide-react';

interface Lesson {
  id: string;
  title: string;
  description: string;
  order: number;
  videoStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
}

interface CourseDetailsData {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  instructorId: string;
  instructor: {
    name: string;
  };
  isEnrolled: boolean;
  lessons: Lesson[];
}

export const CourseDetails: React.FC = () => {
  const { id } = useParams();
  const [course, setCourse] = useState<CourseDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchCourseDetails = async () => {
    try {
      const data = await apiFetch(API_COURSE_DETAILS(id!));
      setCourse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load course details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseDetails();
  }, [id]);

  const handleEnroll = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    setEnrollLoading(true);
    try {
      await apiFetch(API_COURSE_ENROLL(id!), { method: 'POST' });
      await fetchCourseDetails(); // Reload details
    } catch (err: any) {
      alert(err.message || 'Enrollment failed.');
    } finally {
      setEnrollLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full glass-panel rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-4">{error || 'Course not found'}</p>
          <Link to="/" className="text-violet-400 hover:underline text-xs flex items-center justify-center gap-1.5">
            <ArrowLeft size={14} /> Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white text-xs font-semibold uppercase tracking-wider transition"
        >
          <ArrowLeft size={14} /> Back to Catalog
        </Link>
      </div>

      {/* Hero Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-4">
        <div className="lg:col-span-8 space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider text-violet-400 bg-violet-950/30 border border-violet-800/40 uppercase">
            Curriculum Structure
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {course.title}
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed max-w-3xl">
            {course.description}
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400">
            <div>
              Instructor:{' '}
              <span className="text-white font-bold ml-1">{course.instructor.name}</span>
            </div>
            <div className="border-l border-zinc-800 h-4" />
            <div>
              Lessons:{' '}
              <span className="text-white font-bold ml-1">{course.lessons.length}</span>
            </div>
          </div>
        </div>

        {/* Enrollment Card Sidebar */}
        <div className="lg:col-span-4 glass-panel rounded-2xl overflow-hidden p-6 shadow-2xl space-y-6">
          <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            <img
              src={course.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop'}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          </div>

          {course.isEnrolled ? (
            <div className="p-4 bg-violet-950/20 border border-violet-850/30 rounded-xl flex items-center gap-3 text-violet-300 text-xs">
              <CheckCircle className="shrink-0 text-violet-400" size={18} />
              <div>You are enrolled in this course. Access all video content below.</div>
            </div>
          ) : (
            <button
              onClick={handleEnroll}
              disabled={enrollLoading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {enrollLoading ? (
                <>
                  <Loader className="animate-spin" size={16} />
                  Enrolling...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Enroll Now
                </>
              )}
            </button>
          )}
        </div>
      </section>

      {/* Curriculum / Lessons List */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <h2 className="text-lg font-bold text-white mb-6 border-b border-zinc-900 pb-4">Course Curriculum</h2>

        {course.lessons.length === 0 ? (
          <div className="p-12 glass-panel rounded-2xl text-center text-zinc-500 text-sm">
            No lessons have been added to this course yet.
          </div>
        ) : (
          <div className="space-y-4">
            {course.lessons.map((lesson) => {
              const isLocked = !course.isEnrolled;
              const isReady = lesson.videoStatus === 'READY';
              
              return (
                <div
                  key={lesson.id}
                  className={`glass-panel rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border transition ${
                    isLocked ? 'opacity-75' : 'hover:border-zinc-700/60'
                  }`}
                >
                  <div className="space-y-2 flex-grow">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md">
                        Lesson {lesson.order}
                      </span>
                      {isReady && (
                        <span className="text-[9px] font-bold text-green-400 bg-green-950/20 border border-green-900/40 px-1.5 py-0.5 rounded">
                          Video Ready
                        </span>
                      )}
                      {!isReady && lesson.videoStatus === 'PROCESSING' && (
                        <span className="text-[9px] font-bold text-yellow-400 bg-yellow-950/20 border border-yellow-900/40 px-1.5 py-0.5 rounded animate-pulse">
                          Transcoding
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm md:text-base">{lesson.title}</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed max-w-3xl">{lesson.description}</p>
                  </div>

                  <div className="shrink-0 md:pl-4">
                    {isLocked ? (
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-xl text-xs font-semibold">
                        <Lock size={12} />
                        Locked
                      </div>
                    ) : isReady ? (
                      <Link
                        to={`/courses/${course.id}/lessons/${lesson.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" />
                        Watch
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-850 text-zinc-500 rounded-xl text-xs font-semibold"
                      >
                        Unavailable
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
