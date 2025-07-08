import React, { useContext, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Home, 
  Video, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User,
  Bell,
  Search,
  MessageSquare,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import * as conversationAPI from '../api/conversationService';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Meetings', href: '/meetings', icon: Video },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Layout({ children }) {
  const { user, logout } = useContext(AuthContext);
  const { unreadCount: notificationCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    conversationAPI.getConversations()
      .then(res => {
        const convos = res.data.conversations || res.data || [];
        const totalUnread = convos.reduce((sum, c) => sum + (c.unread || 0), 0);
        setUnreadCount(totalUnread);
      })
      .catch(() => {
        setUnreadCount(0);
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const handleSearch = e => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/search?query=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <motion.div
          initial={{ x: -300 }}
          animate={{ x: 0 }}
          exit={{ x: -300 }}
          className="fixed left-0 top-0 h-full w-72 bg-white/20 backdrop-blur-2xl shadow-2xl rounded-r-3xl border-r border-white/20"
        >
          <div className="flex h-20 items-center justify-between px-8">
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tracking-tight">Comm360</h1>
            <button onClick={() => setSidebarOpen(false)} className="hover:bg-white/20 p-2 rounded-full transition">
              <X className="h-7 w-7 text-secondary-500" />
            </button>
          </div>
          <nav className="px-6 py-8 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-lg transition-all duration-200 relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-400/30 to-purple-400/30 text-primary-700 shadow-lg'
                      : 'text-secondary-600 hover:bg-white/10 hover:text-primary-600'
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-gradient-to-b from-blue-400 to-purple-400 transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}></span>
                  <item.icon className="h-6 w-6" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="px-6 mt-auto pb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-primary-800">{user?.fullName || user?.username}</p>
                <p className="text-xs text-secondary-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 text-secondary-600 hover:bg-white/10 hover:text-red-600 rounded-xl font-semibold transition-all"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </motion.div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:fixed lg:inset-y-0 lg:flex ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'} lg:flex-col z-30 transition-all duration-300`}>
        <div className="flex flex-col flex-grow bg-white/20 backdrop-blur-2xl shadow-2xl rounded-r-3xl border-r border-white/20 h-full transition-all duration-300">
          <div className={`flex h-20 items-center ${sidebarCollapsed ? 'px-2 justify-center' : 'px-8'} transition-all duration-300`}>
            <h1 className={`text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent tracking-tight transition-all duration-300 ${sidebarCollapsed ? 'hidden' : 'block'}`}>Comm360</h1>
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className={`ml-auto p-2 rounded-full hover:bg-white/20 transition ${sidebarCollapsed ? '' : 'ml-4'}`}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-6 w-6 text-secondary-500" /> : <ChevronLeft className="h-6 w-6 text-secondary-500" />}
            </button>
          </div>
          <nav className={`flex-1 ${sidebarCollapsed ? 'px-2 py-4' : 'px-6 py-8'} space-y-2 transition-all duration-300`}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl font-semibold text-lg transition-all duration-200 relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-400/30 to-purple-400/30 text-primary-700 shadow-lg'
                      : 'text-secondary-600 hover:bg-white/10 hover:text-primary-600'
                  }`}
                >
                  <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-full bg-gradient-to-b from-blue-400 to-purple-400 transition-all duration-200 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}></span>
                  <item.icon className="h-6 w-6" />
                  {!sidebarCollapsed && item.name}
                </Link>
              );
            })}
          </nav>
          <div className={`px-6 mt-auto pb-8 ${sidebarCollapsed ? 'flex flex-col items-center px-2' : ''} transition-all duration-300`}>
            <div className={`flex items-center gap-3 mb-4 ${sidebarCollapsed ? 'flex-col gap-1' : ''}`}>
              <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg">
                <User className="h-5 w-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <p className="text-base font-bold text-primary-800">{user?.fullName || user?.username}</p>
                  <p className="text-xs text-secondary-500">{user?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-2 w-full px-4 py-2 text-secondary-600 hover:bg-white/10 hover:text-red-600 rounded-xl font-semibold transition-all ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <LogOut className="h-5 w-5" />
              {!sidebarCollapsed && 'Logout'}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'} transition-all duration-300`}>
        {/* Header */}
        <header className="backdrop-blur-xl bg-white/60 bg-gradient-to-r from-blue-100/60 via-white/60 to-purple-100/60 shadow-xl border-b border-white/30 relative z-20">
          <div className="flex h-20 items-center justify-between px-4 sm:px-8 lg:px-16 relative">
            {/* Mobile sidebar button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-full text-blue-500 hover:bg-blue-100/60 transition shadow-md"
            >
              <Menu className="h-7 w-7" />
            </button>

            {/* Floating logo/title */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-3 select-none pointer-events-none">
              <span className="text-3xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent drop-shadow-lg tracking-tight animate-gradient-x">Comm360</span>
            </div>

            {/* Search bar */}
            <form
              onSubmit={handleSearch}
              className="flex-1 flex justify-center"
            >
              <div className="relative w-full max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400/80" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-12 pr-4 py-2 rounded-full bg-white/70 border border-blue-200 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition placeholder:text-blue-300 text-blue-900 text-base"
                />
              </div>
            </form>

            {/* Right icons */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/messages')}
                className="p-2 rounded-full text-blue-500 hover:bg-blue-100/60 transition shadow-md relative"
              >
                <MessageSquare className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="
                    absolute -top-2 -right-2
                    bg-red-500 text-white text-xs font-semibold
                    rounded-full px-1.5 min-w-[1.25rem] h-5
                    flex items-center justify-center
                  ">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <button
                className="p-2 rounded-full text-blue-500 hover:bg-blue-100/60 transition shadow-md relative"
                title="Notifications"
              >
                <Bell className="h-6 w-6" />
                {notificationCount > 0 && (
                  <span className="
                    absolute -top-2 -right-2
                    bg-orange-500 text-white text-xs font-semibold
                    rounded-full px-1.5 min-w-[1.25rem] h-5
                    flex items-center justify-center
                  ">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
              </button>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform cursor-pointer">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-base font-bold text-blue-900 leading-tight">{user?.fullName || user?.username}</p>
                  <p className="text-xs text-blue-400">{user?.email}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
} 