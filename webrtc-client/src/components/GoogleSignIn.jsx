import React from 'react';
import { motion } from 'framer-motion';
import { Chrome } from 'lucide-react';

export function GoogleSignIn() {
  const handleGoogleSignIn = () => {
    // Implement Google OAuth here
  };

  return (
    <motion.button
      type="button"
      onClick={handleGoogleSignIn}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-secondary-300 rounded-lg bg-white text-secondary-700 hover:bg-secondary-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      <Chrome className="h-5 w-5" />
      <span className="font-medium">Continue with Google</span>
    </motion.button>
  );
}