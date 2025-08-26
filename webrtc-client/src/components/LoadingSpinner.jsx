import React from 'react';

/**
 * Simple loading spinner to indicate asynchronous operations.
 *
 * This component renders a centered circular spinner using
 * Tailwind utility classes. You can pass an optional className
 * prop to adjust its height/width or positioning.
 */
export default function LoadingSpinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      {/*
        We use a div with borders to build the spinner. The top
        border is transparent to give the illusion of rotation.
        Tailwind's animate-spin class handles the rotation.
      */}
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
