import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Check, X, ShieldAlert, Loader2, Users } from 'lucide-react';

const AdminApprovalTable = () => {
  const [pendingAdmins, setPendingAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchPendingAdmins = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'pending_admin'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingAdmins(data.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
    } catch (err) {
      console.error("Error fetching pending admins:", err);
      showNotification('error', 'Failed to fetch pending admin requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingAdmins();
  }, []);

  const handleApproveAdmin = async (userId) => {
    setProcessingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'admin'
      });
      showNotification('success', 'User successfully approved as Admin!');
      setPendingAdmins(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      console.error("Approval error:", err);
      showNotification('error', `Failed to approve user: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAdmin = async (userId) => {
    setProcessingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'rejected'
      });
      showNotification('success', 'Admin request rejected.');
      setPendingAdmins(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      console.error("Rejection error:", err);
      showNotification('error', `Failed to reject user: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen pb-24 pt-8 bg-slate-950 text-slate-100 font-sans relative overflow-x-hidden">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3 rounded-xl border shadow-2xl backdrop-blur-md transition-all ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            {notification.type === 'success' ? <Check size={20} /> : <ShieldAlert size={20} />}
            <span className="text-sm font-semibold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center ring-1 ring-indigo-500/30">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Super-Admin Approval Portal</h1>
              <p className="text-sm text-indigo-300 mt-1">Approve or reject pending teacher & admin account applications</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 md:mt-0 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* Stats Panel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">Pending Requests</p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{pendingAdmins.length}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Users size={20} />
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Pending Admin Approvals
            </h2>
            <p className="text-xs text-slate-400 mt-1">Users below have requested administrative roles and require verification</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Requested Role</th>
                  <th className="px-6 py-4 font-medium">Applied Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center text-slate-500">
                      <Loader2 size={36} className="mx-auto mb-4 animate-spin text-indigo-500" />
                      Fetching pending verification requests...
                    </td>
                  </tr>
                ) : pendingAdmins.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center text-slate-500 font-medium">
                      No pending admin requests found.
                    </td>
                  </tr>
                ) : (
                  pendingAdmins.map((user) => (
                    <tr key={user.id} className="transition-colors hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-semibold text-slate-200">{user.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-slate-300 font-mono text-xs">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-indigo-500/10 px-2 py-1 text-xs font-semibold text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                          Teacher/Admin
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => handleApproveAdmin(user.id)}
                            disabled={processingId !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
                          >
                            {processingId === user.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectAdmin(user.id)}
                            disabled={processingId !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 hover:bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
                          >
                            {processingId === user.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <X size={14} />
                            )}
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminApprovalTable;
