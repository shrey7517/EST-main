import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { mcqQuestions, pairedQuestions } from '../data';
import { useAuth } from '../context/AuthContext';
import { LogOut, ChevronRight, ChevronLeft, CheckCircle, Key } from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import AntiCheat from '../components/AntiCheat';

const StudentDashboard = () => {
  const { currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = parseInt(searchParams.get('step')) || 0;

  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [totalScore, setTotalScore] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  const SECTION_TIMES = {
    1: 300,  // 5 minutes
    2: 600,  // 10 minutes
    3: 1800, // 30 minutes
    4: 1200  // 20 minutes
  };

  // Helper to load state from localStorage safely
  const loadProgress = () => {
    if (!currentUser) return {};
    try {
      const saved = localStorage.getItem(`est_progress_${currentUser.uid}`);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error("Failed to load progress:", e);
      return {};
    }
  };

  const progress = loadProgress();

  // State initialization from localStorage
  const [roomKey, setRoomKey] = useState(progress.roomKey || '');
  const [roomError, setRoomError] = useState('');
  const [section1, setSection1] = useState(progress.section1 || Array(11).fill(''));
  const [section2, setSection2] = useState(progress.section2 || Array(32).fill(''));
  const [images, setImages] = useState(progress.images || Array(6).fill(''));
  const [whoAmI, setWhoAmI] = useState(progress.whoAmI || '');
  const [completedSteps, setCompletedSteps] = useState(progress.completedSteps || []);
  const [deadlines, setDeadlines] = useState(progress.deadlines || {});

  // Persist state to localStorage on any change
  useEffect(() => {
    if (!currentUser) return;
    const stateToSave = {
      roomKey,
      section1,
      section2,
      images,
      whoAmI,
      completedSteps,
      deadlines
    };
    localStorage.setItem(`est_progress_${currentUser.uid}`, JSON.stringify(stateToSave));
  }, [roomKey, section1, section2, images, whoAmI, completedSteps, deadlines, currentUser]);

  // Section Access Control & Redirects (sync with URL step)
  useEffect(() => {
    if (!currentUser) return;
    
    const activeStep = completedSteps.length + 1;

    // 1. If roomKey is verified but user is at step 0, redirect to activeStep
    if (roomKey && step === 0) {
      setSearchParams({ step: String(activeStep) });
      return;
    }

    // 2. If roomKey is NOT verified, and user tries to access step > 0, force step 0
    if (!roomKey && step > 0) {
      setSearchParams({ step: '0' });
      return;
    }

    // 3. Prevent navigating back to completed/locked sections
    if (completedSteps.includes(step)) {
      setSearchParams({ step: String(activeStep) });
      return;
    }

    // 4. Prevent skipping ahead to locked sections
    if (step > activeStep && step <= 4) {
      setSearchParams({ step: String(activeStep) });
    }
  }, [step, roomKey, completedSteps, setSearchParams, currentUser]);

  // Timer logic using target deadlines
  const currentDeadline = deadlines[step];
  useEffect(() => {
    if (step >= 1 && step <= 4 && roomKey && !completedSteps.includes(step)) {
      if (currentDeadline) {
        const remaining = Math.max(0, Math.floor((currentDeadline - Date.now()) / 1000));
        setTimeLeft(remaining);
      } else {
        const newDeadline = Date.now() + SECTION_TIMES[step] * 1000;
        setDeadlines(prev => {
          if (prev[step]) return prev;
          return { ...prev, [step]: newDeadline };
        });
        setTimeLeft(SECTION_TIMES[step]);
      }
    } else {
      setTimeLeft(null);
    }
  }, [step, currentDeadline, roomKey, completedSteps]);

  // Countdown execution
  useEffect(() => {
    if (timeLeft === null || completed || loading) return;
    
    if (timeLeft <= 0) {
      if (step < 4) {
        alert("Time's up for this section! Moving to the next one.");
        handleNext();
      } else if (step === 4) {
        alert("Time's up! Automatically submitting your test.");
        handleSubmit();
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(prev => {
        // Double check time left against deadline to avoid tab-throttling slip
        if (currentDeadline) {
          const actualRemaining = Math.max(0, Math.floor((currentDeadline - Date.now()) / 1000));
          return actualRemaining;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, step, completed, loading, currentDeadline]);

  const formatTime = (seconds) => {
    if (seconds === null) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleNext = () => {
    if (step >= 1 && step < 4) {
      setCompletedSteps(prev => {
        if (prev.includes(step)) return prev;
        return [...prev, step];
      });
      setSearchParams({ step: String(step + 1) });
    }
  };

  const handlePrev = () => {
    const prevStep = step - 1;
    if (completedSteps.includes(prevStep)) {
      alert("This section is completed and locked.");
      return;
    }
    setSearchParams({ step: String(prevStep) });
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setRoomError('');
    setLoading(true);
    try {
      const roomDoc = await getDoc(doc(db, 'rooms', roomKey));
      if (!roomDoc.exists()) {
        setRoomError('Invalid Room Key. Please check and try again.');
        return;
      }
      // Room is valid, move to step 1
      setSearchParams({ step: '1' });
    } catch (err) {
      console.error(err);
      setRoomError('Error verifying room key.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    const payload = {
      user_id: currentUser.uid,
      room_key: roomKey,
      section1,
      section2,
      images,
      who_am_i: whoAmI,
    };

    // Calculate Payload Size
    const payloadString = JSON.stringify(payload);
    const payloadSize = new Blob([payloadString]).size;
    console.log(`[Submission] Starting submission. Payload size: ${payloadSize} bytes.`);

    if (payloadSize > 1024 * 1024) {
      console.error("[Submission Error] Payload size exceeds 1MB limit.");
      alert("Submission file size is too large. Please reduce text length in stories.");
      setLoading(false);
      return;
    }

    // Set timeout controller (15 seconds timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      console.log("[Submission] Sending payload to Vercel Serverless API `/api/submit_test`...");
      const res = await fetch(`/api/submit_test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadString,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}: Failed to submit test`);
      }
      
      console.log("[Submission Success] Received evaluation from API:", data);
      
      // Clear localStorage progress on success
      localStorage.removeItem(`est_progress_${currentUser.uid}`);
      setTotalScore(data.total);
      setCompleted(true);

    } catch (err) {
      clearTimeout(timeoutId);
      console.error("[Submission API Error] API submission failed. Attempting client-side Firestore backup write...", err);

      if (err.name === 'AbortError') {
        console.error("[Submission Error] Vercel API timed out after 15 seconds.");
      }

      // Client-Side Failsafe Redundancy Write
      try {
        console.log("[Submission Backup] Writing raw answers directly to Firestore 'results' collection...");
        const backupPayload = {
          user_id: currentUser.uid,
          room_key: roomKey,
          section1,
          section2,
          images: images.map(text => ({ original_text: text, total: 0 })),
          who_am_i: { original_text: whoAmI, total: 0 },
          total: 0,
          createdAt: serverTimestamp(),
          status: "pending_evaluation",
          isBackup: true,
          errorTrace: err.message || 'API Timeout'
        };

        const docRef = await addDoc(collection(db, 'results'), backupPayload);
        console.log(`[Submission Backup Success] Raw answers securely saved under Document ID: ${docRef.id}`);
        
        // Clear localStorage progress on backup success
        localStorage.removeItem(`est_progress_${currentUser.uid}`);
        
        setTotalScore("Grading Pending (Offline Mode)");
        setCompleted(true);
        alert("Your exam responses were saved securely via our backup database. Your score is pending review by the administrator.");

      } catch (firestoreErr) {
        console.error("[Submission Failsafe Failure] Direct Firestore write also failed!", firestoreErr);
        
        // Log firestore specific rule violations
        if (firestoreErr.code === 'permission-denied') {
          console.error("[Firestore Security Violation] Direct write blocked by security rules. Ensure the results rules match student requirements.");
        } else if (firestoreErr.code === 'unavailable') {
          console.error("[Firestore Network Error] Firebase database service is offline or unavailable.");
        }
        
        alert("Failed to submit assessment due to network errors. Please verify your connection and click submit again. Do not close this window.");
      }
    } finally {
      setLoading(false);
    }
  };

  const renderSection1 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">Section 1: Sentence Completion</h3>
      <p className="text-sm text-slate-400">Complete each sentence by selecting the most appropriate option.</p>
      {mcqQuestions.map((q, idx) => (
        <div key={idx} className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
          <p className="mb-4 text-slate-200">{q.q}</p>
          <div className="flex flex-wrap gap-3">
            {q.options.map((opt, i) => {
              const val = String.fromCharCode(97 + i);
              return (
                <button
                  key={i}
                  onClick={() => {
                    const newS1 = [...section1];
                    newS1[idx] = val;
                    setSection1(newS1);
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    section1[idx] === val
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {val}) {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const renderSection2 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">Section 2: Paired Comparison</h3>
      <p className="text-sm text-slate-400">Choose the statement that best describes you.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {pairedQuestions.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 flex flex-col justify-between">
            <p className="mb-4 text-sm font-medium text-slate-400">{item.q}</p>
            <div className="flex flex-col gap-3 mt-auto">
              <button
                onClick={() => {
                  const newS2 = [...section2];
                  newS2[idx] = 'A';
                  setSection2(newS2);
                }}
                className={`rounded-lg p-3 text-left text-sm transition-all ${
                  section2[idx] === 'A'
                    ? 'bg-emerald-600 text-white border-transparent'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                A) {item.A}
              </button>
              <button
                onClick={() => {
                  const newS2 = [...section2];
                  newS2[idx] = 'B';
                  setSection2(newS2);
                }}
                className={`rounded-lg p-3 text-left text-sm transition-all ${
                  section2[idx] === 'B'
                    ? 'bg-emerald-600 text-white border-transparent'
                    : 'bg-slate-900 border border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                B) {item.B}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSection3 = () => (
    <div className="space-y-8">
      <h3 className="text-xl font-semibold text-white">Section 3: Image Imagination</h3>
      <p className="text-sm text-slate-400">Write a short story based on the image provided.</p>
      {images.map((img, idx) => (
        <div key={idx} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800/50">
          <div className="flex flex-col md:flex-row">
            <div className="w-full bg-slate-900 p-4 md:w-1/3 flex items-center justify-center">
              <img src={`/images/img${idx + 1}.jpg`} alt={`Imagination ${idx + 1}`} className="rounded-lg object-contain h-48 w-auto" />
            </div>
            <div className="w-full p-6 md:w-2/3">
              <textarea
                value={images[idx]}
                onChange={(e) => {
                  const newImages = [...images];
                  newImages[idx] = e.target.value;
                  setImages(newImages);
                }}
                placeholder="Write your story here..."
                className="h-full min-h-[150px] w-full resize-none rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-slate-200 placeholder-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderSection4 = () => (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold text-white">Section 4: Who Am I?</h3>
      <p className="text-sm text-slate-400">Write a brief essay about yourself, your goals, and your problem-solving approach.</p>
      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
        <textarea
          value={whoAmI}
          onChange={(e) => setWhoAmI(e.target.value)}
          placeholder="I am someone who..."
          className="h-64 w-full resize-none rounded-lg border border-slate-700 bg-slate-900/50 p-4 text-slate-200 placeholder-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );

  if (step === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl text-center"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400">
            <Key size={32} />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Join a Room</h2>
          <p className="mb-8 text-slate-400">Enter the Room Key provided by your Admin to begin the test.</p>
          
          {roomError && (
            <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
              {roomError}
            </div>
          )}

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <input
              type="text"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-center text-lg tracking-widest text-white placeholder-slate-500 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="ENTER KEY"
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Enter Room'}
            </button>
          </form>
          
          <button
            onClick={handleLogout}
            className="mt-6 text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Logout
          </button>
        </motion.div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-12 text-center shadow-2xl backdrop-blur-xl"
        >
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckCircle size={48} />
          </div>
          <h2 className="mb-2 text-3xl font-bold text-white">Test Completed!</h2>
          <p className="mb-8 text-slate-400">Your responses have been successfully evaluated.</p>
          <div className="mb-8 rounded-xl bg-slate-900/50 p-6 border border-slate-700">
            <p className="text-sm text-slate-400 uppercase tracking-wider font-semibold">Total Score</p>
            <p className="text-6xl font-black text-indigo-400 mt-2">{totalScore}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-slate-700 px-6 py-3 font-semibold text-white transition-all hover:bg-slate-600"
          >
            Logout
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AntiCheat>
      <div className="min-h-screen pb-24 pt-8">
        <div className="mx-auto max-w-5xl px-4">
          {/* Header */}
          <div className="mb-12 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Entrepreneurship Skill Test</h1>
              <p className="text-sm text-indigo-300 mt-1">Logged in as {currentUser?.email}</p>
            </div>
            <div className="flex items-center gap-6">
              {step >= 1 && step <= 4 && timeLeft !== null && (
                <div className={`flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-lg font-bold ${timeLeft < 60 ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse' : 'bg-slate-800 text-emerald-400 border border-slate-700'}`}>
                  ⏱ {formatTime(timeLeft)}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8 flex items-center justify-between">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-1 items-center">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    step >= i
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-slate-700 bg-slate-800 text-slate-500'
                  }`}
                >
                  {i}
                </div>
                {i < 4 && (
                  <div
                    className={`mx-4 h-1 flex-1 rounded-full transition-all ${
                      step > i ? 'bg-indigo-500' : 'bg-slate-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[400px]"
            >
              {step === 1 && renderSection1()}
              {step === 2 && renderSection2()}
              {step === 3 && renderSection3()}
              {step === 4 && renderSection4()}
            </motion.div>
          </AnimatePresence>

          {/* Footer Navigation */}
          <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-6">
            <button
              onClick={handlePrev}
              disabled={step === 1 || completedSteps.includes(step - 1)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-3 font-medium text-slate-300 transition-all hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800"
            >
              <ChevronLeft size={20} /> Previous
            </button>
            
            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-all hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]"
              >
                Next <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 font-bold text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Test'}
              </button>
            )}
          </div>
        </div>
      </div>
    </AntiCheat>
  );
};

export default StudentDashboard;
