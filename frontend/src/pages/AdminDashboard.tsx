import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiFetch } from '../context/AuthContext';
import { API_ADMIN_USERS, API_ADMIN_USER_DELETE } from '../constants/apiUrlConstants';
import {
  BookOpen,
  LogOut,
  Trash2,
  Users,
  Search,
  Loader,
  AlertTriangle,
  ShieldAlert,
  Shield,
  User,
  CheckCircle,
  Filter
} from 'lucide-react';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  createdAt: string;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserRecord | null>(null);
  const [confirmEmailInput, setConfirmEmailInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(API_ADMIN_USERS);
      setUsers(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleOpenDeleteModal = (u: UserRecord) => {
    setUserToDelete(u);
    setConfirmEmailInput('');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToDelete) return;
    
    if (confirmEmailInput.trim().toLowerCase() !== userToDelete.email.trim().toLowerCase()) {
      showToast('Email confirmation does not match.', 'error');
      return;
    }

    setDeleteLoading(true);
    try {
      const response = await apiFetch(API_ADMIN_USER_DELETE(userToDelete.id), {
        method: 'DELETE',
      });
      showToast(response.message || 'User deleted successfully.', 'success');
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Stats calculation
  const totalUsers = users.length;
  const totalInstructors = users.filter((u) => u.role === 'INSTRUCTOR').length;
  const totalStudents = users.filter((u) => u.role === 'STUDENT').length;
  const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;

  // Filter & Search logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin text-violet-500" size={32} />
          <span className="text-zinc-500 text-sm">Loading admin dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border text-sm ${
              notification.type === 'success'
                ? 'bg-green-950/90 border-green-800 text-green-200'
                : 'bg-red-950/90 border-red-800 text-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : (
              <AlertTriangle size={16} className="text-red-400" />
            )}
            {notification.message}
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="border-b border-zinc-900 bg-zinc-900/40 backdrop-blur sticky top-0 z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-lg">
              <BookOpen className="text-white" size={20} />
            </div>
            <span className="font-bold text-lg tracking-tight">StreamLMS</span>
            <span className="text-[10px] font-bold tracking-wider text-violet-400 bg-violet-950/40 border border-violet-900/50 px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1">
              <Shield size={10} />
              Admin Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-xs hidden sm:inline-block">
              Logged in as: <strong className="text-zinc-200">{user?.name}</strong>
            </span>
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

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-800 transition">
            <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalUsers}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-800 transition">
            <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Instructors</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalInstructors}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-800 transition">
            <div className="p-3 bg-zinc-500/10 text-zinc-400 rounded-xl">
              <User size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Students</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalStudents}</h3>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 rounded-2xl p-5 flex items-center gap-4 hover:border-zinc-800 transition">
            <div className="p-3 bg-pink-500/10 text-pink-400 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Admins</p>
              <h3 className="text-2xl font-bold text-white mt-0.5">{totalAdmins}</h3>
            </div>
          </div>
        </section>

        {/* User Management Section */}
        <section className="bg-zinc-900/20 border border-zinc-900 rounded-3xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">User Registry</h2>
              <p className="text-zinc-500 text-xs mt-0.5">Manage student and instructor accounts, and verify portal access.</p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-violet-500 text-xs text-white rounded-xl pl-9 pr-4 py-2.5 w-60 focus:outline-none transition"
                />
              </div>

              {/* Role filter */}
              <div className="relative flex items-center bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-zinc-400 hover:border-zinc-800 transition">
                <Filter size={12} className="mr-2 text-zinc-500" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-200 outline-none border-none cursor-pointer pr-1"
                >
                  <option value="ALL" className="bg-zinc-950">All Roles</option>
                  <option value="INSTRUCTOR" className="bg-zinc-950">Instructors</option>
                  <option value="STUDENT" className="bg-zinc-950">Students</option>
                  <option value="ADMIN" className="bg-zinc-950">Admins</option>
                </select>
              </div>
            </div>
          </div>

          {/* Users List Table */}
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-900 rounded-2xl text-sm text-zinc-500">
              No users found matching the search criteria.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-zinc-900">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900/50 border-b border-zinc-900 text-zinc-400 font-semibold tracking-wider uppercase">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Date Joined</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredUsers.map((u) => {
                    const initials = u.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    const isSelf = user?.id === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-zinc-900/30 transition group">
                        <td className="px-6 py-4 flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            u.role === 'ADMIN'
                              ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                              : u.role === 'INSTRUCTOR'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-white text-sm">{u.name}</span>
                            {isSelf && (
                              <span className="ml-2 text-[9px] bg-violet-950/40 text-violet-400 border border-violet-900 px-1.5 py-0.5 rounded-full uppercase">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-zinc-300 font-medium">{u.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                            u.role === 'ADMIN'
                              ? 'bg-pink-950/20 border-pink-900/40 text-pink-400'
                              : u.role === 'INSTRUCTOR'
                              ? 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-500">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            disabled={isSelf}
                            onClick={() => handleOpenDeleteModal(u)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-950/40 rounded-xl transition cursor-pointer disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 disabled:cursor-not-allowed"
                            title={isSelf ? 'Cannot delete yourself' : 'Delete User'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Delete User Confirmation Modal */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-850 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 bg-red-950/30 rounded-xl border border-red-900/30">
                <ShieldAlert size={20} />
              </div>
              <h3 className="text-lg font-bold text-white">Confirm Delete User</h3>
            </div>

            <div className="space-y-3 text-xs text-zinc-400">
              <p>
                You are about to delete <strong className="text-zinc-150">{userToDelete.name}</strong> ({userToDelete.email}), who is registered as a <span className="font-semibold text-zinc-200">{userToDelete.role}</span>.
              </p>
              {userToDelete.role === 'INSTRUCTOR' && (
                <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-xl text-red-200 leading-relaxed">
                  <strong>Warning for Instructor Deletion:</strong> This action is highly destructive and permanent. Deleting an instructor will:
                  <ul className="list-disc pl-4 mt-1.5 space-y-1">
                    <li>Delete all courses created by this instructor.</li>
                    <li>Delete all lessons and enrollment logs in those courses.</li>
                    <li>Remove any active transcode jobs from queue.</li>
                    <li>Permanently delete raw and processed video stream folders inside MinIO/S3 storage.</li>
                  </ul>
                </div>
              )}
              {userToDelete.role === 'STUDENT' && (
                <p className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-850 text-zinc-300">
                  Deleting this student will remove their account and revoke all their course enrollments.
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div>
                <label className="block text-zinc-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
                  Type the user's email to confirm:
                </label>
                <input
                  type="text"
                  value={confirmEmailInput}
                  onChange={(e) => setConfirmEmailInput(e.target.value)}
                  placeholder={userToDelete.email}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none transition font-medium"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setUserToDelete(null);
                  }}
                  className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl cursor-pointer font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || confirmEmailInput.trim().toLowerCase() !== userToDelete.email.trim().toLowerCase()}
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white rounded-xl cursor-pointer font-bold shadow-lg shadow-red-900/20 transition flex items-center gap-1.5"
                >
                  {deleteLoading ? (
                    <>
                      <Loader size={12} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
