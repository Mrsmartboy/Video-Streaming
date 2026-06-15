import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { API_COURSES } from '../constants/apiUrlConstants';
import { BookOpen, LogOut, Layout, ArrowRight } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  instructor: {
    name: string;
  };
}

export const Home: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await apiFetch(API_COURSES);
        setCourses(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load courses.');
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-12">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg">
              <BookOpen className="text-white" size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">StreamLMS</span>
          </div>

          <div className="flex items-center gap-4">
            {user?.role === 'INSTRUCTOR' && (
              <Link
                to="/instructor-dashboard"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-violet-500 hover:bg-zinc-800/50 text-xs font-semibold tracking-wide transition cursor-pointer text-zinc-300"
              >
                <Layout size={14} />
                Instructor Dashboard
              </Link>
            )}
            <div className="flex items-center gap-3 border-l border-zinc-800 pl-4">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-zinc-200">{user?.name}</div>
                <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">{user?.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl hover:bg-red-950/20 hover:text-red-400 border border-transparent hover:border-red-900/30 transition text-zinc-400 cursor-pointer"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden pt-16 pb-20 border-b border-zinc-900">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider text-violet-400 bg-violet-950/30 border border-violet-800/40 uppercase mb-4">
            Adaptive Streaming Technology
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-6">
            Master Skills with{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-indigo-400 to-purple-400">
              High-Fidelity HLS
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-zinc-400 text-sm sm:text-base leading-relaxed">
            Explore premium software courses designed with adaptive multi-bitrate video streaming.
            Enjoy uninterrupted lessons that adjust automatically to your network bandwidth.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <h2 className="text-xl font-bold text-white mb-6">Explore Course Catalog</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 bg-zinc-900/50 border border-zinc-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-2xl text-red-200 text-sm text-center">
            {error}
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 glass-panel rounded-2xl text-zinc-400 text-sm text-center">
            No courses available at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div key={course.id} className="glass-card rounded-2xl overflow-hidden flex flex-col h-full shadow-lg">
                <div className="aspect-video bg-zinc-900 relative overflow-hidden">
                  <img
                    src={course.imageUrl || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop'}
                    alt={course.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
                </div>

                <div className="p-5 flex flex-col flex-grow">
                  <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-widest mb-1.5">
                    By {course.instructor.name}
                  </span>
                  <h3 className="font-bold text-white text-lg leading-tight mb-2.5 line-clamp-1">{course.title}</h3>
                  <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3 mb-5 flex-grow">
                    {course.description}
                  </p>

                  <Link
                    to={`/courses/${course.id}`}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-violet-600 hover:text-white border border-zinc-800 hover:border-violet-500 rounded-xl text-xs font-semibold text-zinc-300 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    View Curriculum
                    <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
