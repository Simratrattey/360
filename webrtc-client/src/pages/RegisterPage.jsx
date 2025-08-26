// webrtc-client/src/pages/RegisterPage.jsx
import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { Mail, Lock, User, Eye, EyeOff, Loader, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere } from '@react-three/drei';
import { TextureLoader } from 'three';

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, user, error: authError, clearError } = useContext(AuthContext);
  const navigate = useNavigate();

  // if already logged in, go home
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  // Clear error when user types
  useEffect(() => {
    if (error || authError) {
      const timer = setTimeout(() => {
        setError('');
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, authError, clearError]);

  const onSubmit = async e => {
    e.preventDefault();
    setError('');
    clearError();
    
    // Validation
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await register({ fullName, username, email, password });
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Earth texture loader for globe
  function EarthGlobe() {
    const earthMap = useLoader(TextureLoader, '/earth_daymap.jpg');
    return (
      <Sphere args={[1, 64, 64]} position={[0, 0, 0]}>
        <meshStandardMaterial map={earthMap} metalness={0.4} roughness={0.7} />
      </Sphere>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
      {/* Left: Hero with Interactive Globe */}
      <div className="relative flex-1 flex flex-col justify-center items-center p-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={2} />
            <EarthGlobe />
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.5} enablePan={false} />
          </Canvas>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 drop-shadow-xl leading-tight">
              Join <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Comm360</span>
            </h1>
            <p className="text-xl md:text-2xl font-medium mb-8 text-blue-100/90">
              The <span className="font-bold text-white">all-in-one</span> platform for <span className="font-bold text-white">meetings</span>, <span className="font-bold text-white">chat</span>, and <span className="font-bold text-white">collaboration</span>.<br/>
              <span className="text-blue-200">Connect the world. Work from anywhere. Experience the future of communication.</span>
            </p>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, duration: 0.7 }}>
              <span className="inline-block bg-white/10 px-6 py-3 rounded-full text-lg font-semibold shadow-lg backdrop-blur-md border border-white/20 animate-pulse">
                "The most addictive way to connect and create."
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right: Signup Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white/10 backdrop-blur-2xl relative z-20 min-h-screen md:min-h-0">
        <motion.div
          className="w-full max-w-md bg-white/80 rounded-2xl shadow-2xl p-8 border border-white/30 glass-effect"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-3xl font-bold text-primary-700 mb-2 text-center">Create your Comm360 account</h2>
          <p className="text-secondary-600 text-center mb-8">Sign up and start collaborating instantly.</p>
          <form onSubmit={onSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="input-field pl-10"
                  placeholder="Jane Doe"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  className="input-field pl-10"
                  placeholder="janedoe123"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="input-field pl-10"
                  placeholder="jane@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-primary-500 focus:outline-none"
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="input-field"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-3 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader className="animate-spin h-5 w-5" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
          
          <AnimatePresence>
            {(error || authError) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2"
              >
                <AlertCircle className="h-5 w-5" />
                <span>{error || authError}</span>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="mt-8 text-center text-secondary-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline font-medium">Sign in</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}