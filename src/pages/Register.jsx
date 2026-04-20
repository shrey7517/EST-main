import React, { useState } from 'react';
import { createUserWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus } from 'lucide-react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name,
        email,
        role: role === 'admin' ? 'pending_admin' : 'student',
        createdAt: new Date().toISOString()
      });
      
      // Send verification email
      await sendEmailVerification(userCredential.user);
      
      // Sign out the user immediately so they must verify their email before logging in
      await auth.signOut();
      
      if (role === 'admin') {
        alert("Admin account created! An approval request has been sent. Please check your inbox and spam folder to verify your email address.");
      } else {
        alert("Account created successfully! Please check your inbox and spam folder to verify your email address before logging in.");
      }
      
      navigate('/login');
    } catch (err) {
      console.error("Registration error:", err);
      setError(err.message || 'Failed to create an account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50">
            <UserPlus size={32} />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Create Account</h2>
          <p className="mt-2 text-sm text-slate-400">Join the EST platform today</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                role === 'student' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Applicant
            </button>
            <button
              type="button"
              onClick={() => setRole('admin')}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              Admin
            </button>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Full Name</label>
            <input
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password"
              required
              minLength="6"
              autoComplete="new-password"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3 text-white placeholder-slate-500 outline-none transition-all focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg px-4 py-3 font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-50 ${
              role === 'student' ? 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_20px_rgba(79,70,229,0.3)]'
            }`}
          >
            {loading ? 'Creating...' : `Register as ${role === 'student' ? 'Applicant' : 'Admin'}`}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className={`font-medium transition-colors ${role === 'student' ? 'text-emerald-400 hover:text-emerald-300' : 'text-indigo-400 hover:text-indigo-300'}`}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Register;
