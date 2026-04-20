import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { LogOut, Download, Loader2, Edit2, Check } from 'lucide-react';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editScore, setEditScore] = useState('');

  const fetchResults = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'results'));
      const data = [];
      for (const docSnap of querySnapshot.docs) {
        const resultData = docSnap.data();
        // Fetch user info
        let userName = 'Unknown';
        try {
          const userDoc = await getDoc(doc(db, 'users', resultData.user_id));
          if (userDoc.exists()) userName = userDoc.data().name || userDoc.data().email;
        } catch (e) {
          console.error("Error fetching user", e);
        }
        data.push({ id: docSnap.id, userName, ...resultData });
      }
      setResults(data);
    } catch (err) {
      console.error('Error fetching results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleExport = () => {
    const wsData = results.map(r => ({
      'Result ID': r.id,
      'User Name': r.userName,
      'User ID': r.user_id,
      'Total Score': r.total,
      'Submission Date': r.createdAt ? new Date(r.createdAt).toLocaleString() : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EST Results");
    XLSX.writeFile(wb, "EST_Results.xlsx");
  };

  const saveEdit = async (id) => {
    try {
      await updateDoc(doc(db, 'results', id), {
        total: parseInt(editScore, 10)
      });
      setResults(results.map(r => r.id === id ? { ...r, total: parseInt(editScore, 10) } : r));
      setEditingId(null);
    } catch (err) {
      alert("Error updating score");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-8 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-indigo-300 mt-1">Manage EST Results & Users</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            <button
              onClick={handleExport}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            >
              <Download size={16} /> Export to Excel
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Results Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">User Name</th>
                  <th className="px-6 py-4 font-medium">User ID</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-center">Total Score</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      <Loader2 size={32} className="mx-auto mb-4 animate-spin text-indigo-500" />
                      Loading results...
                    </td>
                  </tr>
                ) : results.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                      No results found in the database.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-medium text-slate-200">{r.userName}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{r.user_id}</td>
                      <td className="px-6 py-4 text-slate-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingId === r.id ? (
                          <input
                            type="number"
                            value={editScore}
                            onChange={(e) => setEditScore(e.target.value)}
                            className="w-20 rounded bg-slate-950 px-2 py-1 text-center text-white border border-indigo-500 outline-none"
                            autoFocus
                          />
                        ) : (
                          <span className="inline-flex items-center justify-center rounded-full bg-indigo-500/10 px-3 py-1 font-bold text-indigo-400 border border-indigo-500/20">
                            {r.total}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {editingId === r.id ? (
                          <button
                            onClick={() => saveEdit(r.id)}
                            className="rounded p-1 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                            title="Save"
                          >
                            <Check size={18} />
                          </button>
                        ) : (
                          <button
                            onClick={() => { setEditingId(r.id); setEditScore(r.total.toString()); }}
                            className="rounded p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors"
                            title="Edit Score"
                          >
                            <Edit2 size={18} />
                          </button>
                        )}
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

export default AdminDashboard;
