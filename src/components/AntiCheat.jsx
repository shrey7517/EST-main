import React, { useState, useEffect } from 'react';

const AntiCheat = ({ children }) => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    // 1. Disable Right-Click
    const handleContextMenu = (e) => {
      e.preventDefault();
      alert("Right-click is disabled during the assessment.");
    };

    // 2. Disable Copy, Cut, and Paste
    const handleCopy = (e) => {
      e.preventDefault();
      alert("Copying text is disabled during the assessment.");
    };

    const handleCut = (e) => {
      e.preventDefault();
      alert("Cutting text is disabled during the assessment.");
    };

    const handlePaste = (e) => {
      e.preventDefault();
      alert("Paste is disabled during the assessment.");
    };

    // 3. Prevent Screenshot Shortcuts and DevTools
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

      // PrintScreen key detection
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        // Clear clipboard immediately to block screenshot contents
        try {
          navigator.clipboard.writeText('');
        } catch (err) {
          console.error("Clipboard clear failed:", err);
        }
        alert("Screenshots are strictly prohibited.");
      }

      // Ctrl+C / Cmd+C (Copy)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        alert("Copy shortcut (Ctrl/Cmd+C) is disabled.");
      }

      // Ctrl+X / Cmd+X (Cut)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        alert("Cut shortcut (Ctrl/Cmd+X) is disabled.");
      }

      // Ctrl+V / Cmd+V (Paste)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        alert("Paste shortcut (Ctrl/Cmd+V) is disabled.");
      }

      // DevTools: F12, Ctrl+Shift+I / Cmd+Opt+I, Ctrl+Shift+J / Cmd+Opt+J
      if (e.key === 'F12' || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') ||
          (isMac && e.metaKey && e.altKey && e.key.toLowerCase() === 'i') ||
          (isMac && e.metaKey && e.altKey && e.key.toLowerCase() === 'j')
      ) {
        e.preventDefault();
        alert("Developer tools are disabled during the assessment.");
      }

      // macOS Screenshot shortcuts: Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5
      if (isMac && e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4' || e.key === '5')) {
        e.preventDefault();
        alert("Screenshots are strictly prohibited.");
      }
    };

    // 4. Focus loss detection
    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    // Attach Event Listeners
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('cut', handleCut);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Clean up
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full">
      {/* Content wrapper with conditional blur */}
      <div 
        className={`w-full min-h-screen transition-all duration-300 ${
          isBlurred ? 'filter blur-3xl select-none pointer-events-none' : ''
        }`}
      >
        {children}
      </div>

      {/* Focus Lost Overlay */}
      {isBlurred && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 p-6 text-center backdrop-blur-md">
          <div className="max-w-md rounded-2xl border border-red-500/30 bg-slate-900/90 p-8 shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              ⚠️
            </div>
            <h2 className="mb-2 text-2xl font-bold text-white">Assessment Suspended</h2>
            <p className="mb-6 text-slate-400 text-sm leading-relaxed">
              You navigated away or lost window focus. Moving outside the exam screen triggers an anti-cheat lock. Click the button below to resume.
            </p>
            <button 
              onClick={() => window.focus()} 
              className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-900/50"
            >
              Resume Test
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AntiCheat;
