import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import {
  API_COURSES,
  API_COURSES_INSTRUCTOR,
  API_COURSE_DETAILS,
  API_COURSE_CREATE_LESSON,
  API_LESSON_UPDATE,
  API_LESSON_DELETE,
  API_VIDEO_UPLOAD_URL,
  API_VIDEO_UPLOAD_COMPLETE,
  API_VIDEO_IMPORT_URL,
  API_VIDEO_DELETE,
} from '../constants/apiUrlConstants';
import { BookOpen, LogOut, Plus, ChevronRight, Video, CheckCircle, AlertTriangle, Loader, Upload, ArrowLeft, Edit, Trash2, RefreshCw } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  _count?: {
    enrollments: number;
  };
}

interface Lesson {
  id: string;
  title: string;
  description: string;
  order: number;
  videoStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
}

export const Dashboard: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  
  // Modals & Forms State
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseImage, setNewCourseImage] = useState('');

  const [showLessonModal, setShowLessonModal] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');
  const [newLessonOrder, setNewLessonOrder] = useState('1');

  // Edit Lesson State
  const [showEditLessonModal, setShowEditLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonDesc, setEditLessonDesc] = useState('');
  const [editLessonOrder, setEditLessonOrder] = useState('1');

  // Replace Video State (maps lessonId to boolean)
  const [replaceVideoLessons, setReplaceVideoLessons] = useState<Record<string, boolean>>({});

  // Delete Lesson Confirmation Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Video Upload State
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Video URL Import State
  const [activeImportLessonId, setActiveImportLessonId] = useState<string | null>(null);
  const [importUrlInput, setImportUrlInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [courseDetailsLoading, setCourseDetailsLoading] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'INSTRUCTOR') {
      navigate('/');
      return;
    }
    fetchInstructorCourses();
  }, [user]);

  // Polling for processing videos
  useEffect(() => {
    if (!selectedCourse) return;

    const hasProcessingLessons = lessons.some(l => l.videoStatus === 'PROCESSING');
    if (!hasProcessingLessons) return;

    const interval = setInterval(() => {
      fetchCourseLessons(selectedCourse.id, false); // Fetch without full page loaders
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedCourse, lessons]);

  const fetchInstructorCourses = async () => {
    try {
      const data = await apiFetch(API_COURSES_INSTRUCTOR);
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseLessons = async (courseId: string, showLoader = true) => {
    if (showLoader) setCourseDetailsLoading(true);
    try {
      const data = await apiFetch(API_COURSE_DETAILS(courseId));
      setLessons(data.lessons || []);
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoader) setCourseDetailsLoading(false);
    }
  };

  const handleSelectCourse = (course: Course) => {
    setSelectedCourse(course);
    fetchCourseLessons(course.id);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(API_COURSES, {
        method: 'POST',
        body: JSON.stringify({
          title: newCourseTitle,
          description: newCourseDesc,
          imageUrl: newCourseImage || undefined,
        }),
      });
      setShowCourseModal(false);
      setNewCourseTitle('');
      setNewCourseDesc('');
      setNewCourseImage('');
      fetchInstructorCourses();
    } catch (err) {
      alert('Error creating course.');
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    try {
      await apiFetch(API_COURSE_CREATE_LESSON(selectedCourse.id), {
        method: 'POST',
        body: JSON.stringify({
          title: newLessonTitle,
          description: newLessonDesc,
          order: newLessonOrder,
        }),
      });
      setShowLessonModal(false);
      setNewLessonTitle('');
      setNewLessonDesc('');
      setNewLessonOrder(String(lessons.length + 2));
      fetchCourseLessons(selectedCourse.id);
    } catch (err) {
      alert('Error creating lesson.');
    }
  };

  const handleVideoUpload = async (lessonId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    if (file.type !== 'video/mp4') {
      alert('Please upload an MP4 video file.');
      return;
    }

    setUploadingLessonId(lessonId);
    setUploadProgress(10); // Start progress bar

    try {
      // 1. Get pre-signed upload URL
      const { uploadUrl } = await apiFetch(API_VIDEO_UPLOAD_URL(lessonId), {
        method: 'POST',
      });
      setUploadProgress(30);

      // 2. Upload file directly to MinIO
      // Using xhr to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', 'video/mp4');

        xhr.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 60) + 30;
            setUploadProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(file);
      });

      setUploadProgress(95);

      // 3. Notify backend upload complete to trigger BullMQ worker
      await apiFetch(API_VIDEO_UPLOAD_COMPLETE(lessonId), {
        method: 'POST',
      });
      
      setUploadProgress(100);
      setTimeout(() => {
        setUploadingLessonId(null);
        setUploadProgress(0);
        if (selectedCourse) fetchCourseLessons(selectedCourse.id, false);
      }, 1000);

    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error uploading video.');
      setUploadingLessonId(null);
      setUploadProgress(0);
    }
  };

  const handleImportUrl = async (lessonId: string) => {
    if (!importUrlInput) return;
    setImportLoading(true);
    try {
      await apiFetch(API_VIDEO_IMPORT_URL(lessonId), {
        method: 'POST',
        body: JSON.stringify({ url: importUrlInput }),
      });
      setActiveImportLessonId(null);
      setImportUrlInput('');
      if (selectedCourse) fetchCourseLessons(selectedCourse.id, false);
    } catch (err: any) {
      alert(err.message || 'Failed to import video from URL.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleOpenDeleteModal = (lesson: Lesson) => {
    setDeletingLesson(lesson);
    setDeleteConfirmInput('');
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteLesson = async () => {
    if (!deletingLesson) return;
    setDeleteLoading(true);
    try {
      await apiFetch(API_LESSON_DELETE(deletingLesson.id), {
        method: 'DELETE',
      });
      setShowDeleteModal(false);
      setDeletingLesson(null);
      setDeleteConfirmInput('');
      if (selectedCourse) {
        fetchCourseLessons(selectedCourse.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete lesson.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditLessonTitle(lesson.title);
    setEditLessonDesc(lesson.description);
    setEditLessonOrder(String(lesson.order));
    setShowEditLessonModal(true);
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLessonId) return;
    try {
      await apiFetch(API_LESSON_UPDATE(editingLessonId), {
        method: 'PUT',
        body: JSON.stringify({
          title: editLessonTitle,
          description: editLessonDesc,
          order: Number(editLessonOrder),
        }),
      });
      setShowEditLessonModal(false);
      setEditingLessonId(null);
      if (selectedCourse) {
        fetchCourseLessons(selectedCourse.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update lesson.');
    }
  };

  const handleDeleteVideo = async (lessonId: string) => {
    if (!window.confirm('Are you sure you want to delete this video? This will reset the lesson status to pending and clear the files.')) {
      return;
    }
    try {
      await apiFetch(API_VIDEO_DELETE(lessonId), {
        method: 'DELETE',
      });
      // Reset replace state
      setReplaceVideoLessons(prev => ({ ...prev, [lessonId]: false }));
      if (selectedCourse) {
        fetchCourseLessons(selectedCourse.id);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete video.');
    }
  };

  const toggleReplaceVideo = (lessonId: string) => {
    setReplaceVideoLessons(prev => ({
      ...prev,
      [lessonId]: !prev[lessonId]
    }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg">
              <BookOpen className="text-white" size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">StreamLMS</span>
            <span className="text-[10px] font-bold tracking-wider text-violet-400 bg-violet-950/40 border border-violet-850 px-2 py-0.5 rounded-full uppercase">
              Instructor Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Student View
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl hover:bg-red-950/20 hover:text-red-400 border border-transparent hover:border-red-900/30 transition text-zinc-400 cursor-pointer"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel grid */}
      <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8 overflow-hidden">
        {/* Left Side: Courses list */}
        <div className={`w-full lg:w-1/3 flex flex-col gap-4 ${selectedCourse ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Your Courses</h2>
            <button
              onClick={() => setShowCourseModal(true)}
              className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow-lg transition cursor-pointer"
              title="Create Course"
            >
              <Plus size={16} />
            </button>
          </div>

          {courses.length === 0 ? (
            <div className="p-8 glass-panel rounded-2xl text-center text-zinc-500 text-sm">
              You haven't created any courses yet.
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
              {courses.map((course) => (
                <button
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className={`w-full text-left p-4 rounded-2xl border transition text-sm flex items-center justify-between gap-3 ${
                    selectedCourse?.id === course.id
                      ? 'bg-violet-600/10 border-violet-500 text-white font-semibold'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-300 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="truncate pr-4">
                    <div className="truncate">{course.title}</div>
                    <div className="text-[10px] text-zinc-500 font-semibold mt-1 uppercase">
                      {course._count?.enrollments || 0} enrolled
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 opacity-60" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Course lessons and uploader */}
        <div className={`w-full lg:w-2/3 flex flex-col gap-4 ${selectedCourse ? 'flex' : 'hidden lg:flex items-center justify-center border border-dashed border-zinc-800 rounded-3xl p-12 text-zinc-500 text-sm'}`}>
          {selectedCourse ? (
            <>
              {/* Mobile Back Button */}
              <button
                onClick={() => setSelectedCourse(null)}
                className="lg:hidden flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs mb-2"
              >
                <ArrowLeft size={14} /> Back to Courses
              </button>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedCourse.title}</h2>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{selectedCourse.description}</p>
                </div>
                <button
                  onClick={() => setShowLessonModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-violet-900/30"
                >
                  <Plus size={14} />
                  Add Lesson
                </button>
              </div>

              {courseDetailsLoading ? (
                <div className="flex-grow flex items-center justify-center">
                  <Loader className="animate-spin text-violet-500" size={24} />
                </div>
              ) : lessons.length === 0 ? (
                <div className="flex-grow flex items-center justify-center p-12 text-zinc-500 text-xs text-center">
                  No lessons found. Create a lesson to upload a video.
                </div>
              ) : (
                <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-250px)] pr-2">
                  {lessons.map((lesson) => (
                    <div key={lesson.id} className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-zinc-850">
                      <div className="space-y-1.5 flex-grow">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] font-semibold text-zinc-500 uppercase bg-zinc-900 px-1.5 py-0.5 rounded">
                            Lesson {lesson.order}
                          </span>
                          {lesson.videoStatus === 'READY' && (
                            <span className="text-[9px] font-bold text-green-400 bg-green-950/20 border border-green-900/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <CheckCircle size={10} />
                              Ready for Streaming
                            </span>
                          )}
                          {lesson.videoStatus === 'PROCESSING' && (
                            <span className="text-[9px] font-bold text-yellow-400 bg-yellow-950/20 border border-yellow-900/40 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                              <Loader size={10} className="animate-spin" />
                              Transcoding HLS...
                            </span>
                          )}
                          {lesson.videoStatus === 'FAILED' && (
                            <span className="text-[9px] font-bold text-red-400 bg-red-950/20 border border-red-900/40 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <AlertTriangle size={10} />
                              Transcoding Failed
                            </span>
                          )}
                          
                          <div className="flex items-center gap-1 ml-2 border-l border-zinc-850 pl-2">
                            <button
                              onClick={() => handleOpenEditLesson(lesson)}
                              className="p-1 text-zinc-500 hover:text-zinc-355 hover:bg-zinc-900 rounded transition cursor-pointer"
                              title="Edit Lesson Details"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteModal(lesson)}
                              className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 rounded transition cursor-pointer"
                              title="Delete Lesson"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-bold text-white text-sm">{lesson.title}</h3>
                        <p className="text-zinc-400 text-xs line-clamp-1">{lesson.description}</p>
                      </div>

                      {/* Video actions */}
                      <div className="shrink-0 flex items-center gap-3">
                        {uploadingLessonId === lesson.id ? (
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between text-[10px] text-zinc-400 font-semibold uppercase">
                              <span>Uploading</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="h-full bg-violet-600 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (lesson.videoStatus === 'PENDING' || replaceVideoLessons[lesson.id]) ? (
                          <div className="flex flex-col gap-2 items-end">
                            {activeImportLessonId === lesson.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="url"
                                  value={importUrlInput}
                                  onChange={(e) => setImportUrlInput(e.target.value)}
                                  placeholder="Paste video URL (Gdrive/MP4)"
                                  className="bg-zinc-900 border border-zinc-800 text-xs rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-violet-500 w-52"
                                  disabled={importLoading}
                                />
                                <button
                                  onClick={() => handleImportUrl(lesson.id)}
                                  disabled={importLoading || !importUrlInput}
                                  className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-55"
                                >
                                  {importLoading ? '...' : 'Import'}
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveImportLessonId(null);
                                    setImportUrlInput('');
                                  }}
                                  disabled={importLoading}
                                  className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <label className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition flex items-center gap-1.5 cursor-pointer">
                                  <Upload size={12} />
                                  Upload MP4
                                  <input
                                    type="file"
                                    accept="video/mp4"
                                    onChange={(e) => handleVideoUpload(lesson.id, e)}
                                    className="hidden"
                                  />
                                </label>
                                <button
                                  onClick={() => setActiveImportLessonId(lesson.id)}
                                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
                                >
                                  Import URL
                                </button>
                                {replaceVideoLessons[lesson.id] && (
                                  <button
                                    onClick={() => toggleReplaceVideo(lesson.id)}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-800 rounded-xl text-xs font-semibold transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : lesson.videoStatus === 'READY' || lesson.videoStatus === 'FAILED' ? (
                          <div className="flex items-center gap-2">
                            {lesson.videoStatus === 'READY' && (
                              <Link
                                to={`/courses/${selectedCourse.id}/lessons/${lesson.id}`}
                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Video size={12} />
                                Preview Stream
                              </Link>
                            )}
                            <button
                              onClick={() => toggleReplaceVideo(lesson.id)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
                              title="Replace Video"
                            >
                              <RefreshCw size={12} />
                              Replace
                            </button>
                            <button
                              onClick={() => handleDeleteVideo(lesson.id)}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-red-950/20 hover:text-red-400 border border-zinc-800 hover:border-red-900/30 rounded-xl text-xs font-semibold text-zinc-400 transition cursor-pointer flex items-center gap-1.5"
                              title="Remove Video File"
                            >
                              Remove Video
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 italic font-semibold">Awaiting Queue...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>Select a course from the sidebar list to manage modules, lessons, and video content.</>
          )}
        </div>
      </div>

      {/* Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create New Course</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4 text-sm">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Course Title</label>
                <input
                  type="text"
                  value={newCourseTitle}
                  onChange={(e) => setNewCourseTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  placeholder="e.g. Introduction to TypeScript"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Course Description</label>
                <textarea
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition h-20"
                  placeholder="Describe your course curriculum..."
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Image URL (Optional)</label>
                <input
                  type="url"
                  value={newCourseImage}
                  onChange={(e) => setNewCourseImage(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl cursor-pointer shadow-lg shadow-violet-900/30 font-semibold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Lesson</h3>
            <form onSubmit={handleCreateLesson} className="space-y-4 text-sm">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Title</label>
                <input
                  type="text"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  placeholder="e.g. Chapter 1: Initializing Settings"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Description</label>
                <textarea
                  value={newLessonDesc}
                  onChange={(e) => setNewLessonDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition h-20"
                  placeholder="Outline what students will learn in this lesson..."
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Order Index</label>
                <input
                  type="number"
                  min="1"
                  value={newLessonOrder}
                  onChange={(e) => setNewLessonOrder(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl cursor-pointer shadow-lg shadow-violet-900/30 font-semibold"
                >
                  Add Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal — rendered in portal to escape stacking contexts */}
      {showEditLessonModal && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Lesson Details</h3>
            <form onSubmit={handleUpdateLesson} className="space-y-4 text-sm">
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Title</label>
                <input
                  type="text"
                  value={editLessonTitle}
                  onChange={(e) => setEditLessonTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  placeholder="e.g. Chapter 1: Initializing Settings"
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Description</label>
                <textarea
                  value={editLessonDesc}
                  onChange={(e) => setEditLessonDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition h-20"
                  placeholder="Outline what students will learn in this lesson..."
                  required
                />
              </div>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Lesson Order Index</label>
                <input
                  type="number"
                  min="1"
                  value={editLessonOrder}
                  onChange={(e) => setEditLessonOrder(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-violet-500 transition"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditLessonModal(false);
                    setEditingLessonId(null);
                  }}
                  className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl cursor-pointer shadow-lg shadow-violet-900/30 font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Delete Lesson Confirmation Modal */}
      {showDeleteModal && deletingLesson && createPortal(
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Delete Lesson</h3>
            <p className="text-sm text-zinc-400">
              This action <span className="text-red-400 font-semibold">cannot be undone</span>. This will permanently delete the lesson and all associated video files from storage.
            </p>
            <p className="text-sm text-zinc-400">
              To confirm, type <span className="font-bold text-white">{deletingLesson.title}</span> below:
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition"
              placeholder="Type the lesson title to confirm"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingLesson(null);
                  setDeleteConfirmInput('');
                }}
                disabled={deleteLoading}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteLesson}
                disabled={deleteConfirmInput !== deletingLesson.title || deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl cursor-pointer shadow-lg shadow-red-900/30 font-semibold text-sm transition"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Lesson'}
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};
