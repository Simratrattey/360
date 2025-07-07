import React, { useState, useContext, useEffect } from 'react';

import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, MeshDistortMaterial } from '@react-three/drei';

import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff,
  Loader, 
  User,
  Smartphone,
  Shield,
  Video,
  MessageCircle,
  Zap,
  ArrowRight,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [showFeatures, setShowFeatures] = useState(false);
  
  const { login, googleLogin, error, clearError } = useContext(AuthContext);
  const navigate = useNavigate();

  // Animate features on mount
  useEffect(() => {
    const timer = setTimeout(() => setShowFeatures(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error) clearError();
  };

  const handleFieldFocus = (fieldName) => {
    setActiveField(fieldName);
  };

  const handleFieldBlur = () => {
    setActiveField(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(formData.email, formData.password);
    
    if (result.success) {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const features = [
    {
      icon: Video,
      title: "HD Video Calls",
      description: "Crystal clear video conferencing with WebRTC technology"
    },
    {
      icon: MessageCircle,
      title: "Real-time Chat",
      description: "Instant messaging during meetings"
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "End-to-end encryption for your conversations"
    },
    {
      icon: Zap,
      title: "AI Assistant",
      description: "Smart AI features for enhanced productivity"
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  const formVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  };

  const featureVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900">
      {/* Left: Hero with Interactive Globe */}
      <div className="relative flex-1 flex flex-col justify-center items-center p-8 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 3.5], fov: 50 }} style={{ width: '100%', height: '100%' }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={2} />
            <Sphere args={[1, 64, 64]} position={[0, 0, 0]}>
              <MeshDistortMaterial
                color="#4f46e5"
                attach="material"
                distort={0.25}
                speed={2}
                roughness={0.2}
                metalness={0.7}
              />
            </Sphere>
            <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={1.5} enablePan={false} />
          </Canvas>
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center text-center text-white max-w-xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 drop-shadow-xl leading-tight">
              Welcome to <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Comm360</span>
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

      {/* Right: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 bg-white/10 backdrop-blur-2xl relative z-20 min-h-screen md:min-h-0">
        <motion.div
          className="w-full max-w-md bg-white/80 rounded-2xl shadow-2xl p-8 border border-white/30 glass-effect"
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <h2 className="text-3xl font-bold text-primary-700 mb-2 text-center">Sign in to Comm360</h2>
          <p className="text-secondary-600 text-center mb-8">Start your journey. One account, endless possibilities.</p>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus('email')}
                  onBlur={handleFieldBlur}
                  className={`input-field pl-10 ${activeField === 'email' ? 'ring-2 ring-primary-400' : ''}`}
                  placeholder="you@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-secondary-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus('password')}
                  onBlur={handleFieldBlur}
                  className={`input-field pl-10 pr-10 ${activeField === 'password' ? 'ring-2 ring-primary-400' : ''}`}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-secondary-400 hover:text-primary-500 focus:outline-none"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Link to="/forgot" className="text-primary-600 hover:underline text-sm font-medium">Forgot password?</Link>
            </div>
            <motion.button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center space-x-3 group disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: isLoading ? 1 : 1.02, y: isLoading ? 0 : -2 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              variants={itemVariants}
            >
              {isLoading ? <Loader className="animate-spin h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
              <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
            </motion.button>
          </form>
          <div className="my-6 flex items-center justify-center gap-2">
            <span className="h-px w-10 bg-secondary-200" />
            <span className="text-secondary-400 text-sm">or</span>
            <span className="h-px w-10 bg-secondary-200" />
          </div>
          <div className="flex flex-col gap-4">
            <GoogleLogin
              onSuccess={credentialResponse => {
                const idToken = credentialResponse.credential;
                googleLogin(idToken);
              }}
              onError={() => alert('Google login failed')}
              width="400"
              theme="filled_blue"
              shape="pill"
              text="signin_with"
            />
          </div>
          <div className="mt-8 text-center text-secondary-500 text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:underline font-medium">Sign up</Link>
          </div>
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2"
              >
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}