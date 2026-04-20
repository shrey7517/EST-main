import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, query, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { LogOut, Download, Loader2, Edit2, Check, Plus, Key, Eye, X, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [results, setResults] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoomStudents, setNewRoomStudents] = useState('');
  
  const [editingId, setEditingId] = useState(null);
  const [editScore, setEditScore] = useState('');
  
  const [viewingResult, setViewingResult] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Helper to safely format Firestore timestamp
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    return new Date(timestamp).toLocaleDateString();
  };

  // Fetch Rooms created by this admin
  const fetchRooms = async () => {
    try {
      const q = query(collection(db, 'rooms'), where('admin_id', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const roomsData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRooms(roomsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      if (roomsData.length > 0 && !selectedRoom) {
        setSelectedRoom(roomsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  // Fetch results for the selected room
  const fetchResults = async () => {
    if (!selectedRoom) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, 'results'), where('room_key', '==', selectedRoom));
      const querySnapshot = await getDocs(q);
      const data = [];
      for (const docSnap of querySnapshot.docs) {
        const resultData = docSnap.data();
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
    fetchRooms();
  }, [currentUser]);

  useEffect(() => {
    fetchResults();
  }, [selectedRoom]);

  const handleLogout = () => {
    signOut(auth);
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomStudents) return;
    setCreatingRoom(true);
    try {
      // Generate 6 character random key
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let key = '';
      for (let i = 0; i < 6; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      await setDoc(doc(db, 'rooms', key), {
        admin_id: currentUser.uid,
        expected_students: parseInt(newRoomStudents, 10),
        createdAt: new Date().toISOString()
      });
      
      setNewRoomStudents('');
      await fetchRooms();
      setSelectedRoom(key); // Auto-select the new room
    } catch (err) {
      console.error('Error creating room:', err);
      alert('Failed to create room.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleExport = () => {
    const wsData = results.map(r => ({
      'Result ID': r.id,
      'User Name': r.userName,
      'User ID': r.user_id,
      'Total Score': r.total,
      'Submission Date': formatDate(r.createdAt)
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Room_${selectedRoom}_Results`);
    XLSX.writeFile(wb, `Room_${selectedRoom}_Results.xlsx`);
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

  const handleDownloadAIReport = async () => {
    if (!selectedRoom) return;
    setDownloadingId('room');
    try {
      const res = await fetch(`/api/generate_room_report/${selectedRoom}`);
      if (!res.ok) throw new Error("Failed to generate room report");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Room_${selectedRoom}_Analysis_Report.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download AI room report. Please check the backend connection.");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen pb-24 pt-8 bg-slate-950">
      <div className="mx-auto max-w-7xl px-4">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Admin Dashboard</h1>
            <p className="text-sm text-indigo-300 mt-1">Manage EST Results & Rooms</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-slate-700 hover:text-white"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Rooms */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">Create Room</h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">Expected Students</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newRoomStudents}
                    onChange={(e) => setNewRoomStudents(e.target.value)}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                    placeholder="e.g. 50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={creatingRoom}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Plus size={16} /> {creatingRoom ? 'Creating...' : 'Generate Room Key'}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">Your Rooms</h2>
              {rooms.length === 0 ? (
                <p className="text-sm text-slate-500">No rooms created yet.</p>
              ) : (
                <div className="space-y-2">
                  {rooms.map(room => (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoom(room.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all ${
                        selectedRoom === room.id 
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/50' 
                          : 'bg-slate-800 text-slate-400 border border-transparent hover:bg-slate-700'
                      }`}
                    >
                      <span className="font-mono font-bold tracking-wider">{room.id}</span>
                      <span className="text-xs bg-slate-950 px-2 py-1 rounded-full">{room.expected_students} stds</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Content - Results */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Key size={20} className="text-indigo-400" />
                    Room: {selectedRoom ? <span className="font-mono tracking-widest text-indigo-300">{selectedRoom}</span> : 'None Selected'}
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {results.length} students have completed the test in this room.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadAIReport}
                    disabled={!selectedRoom || results.length === 0 || downloadingId === 'room'}
                    className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600"
                  >
                    {downloadingId === 'room' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} 
                    AI Analysis Report
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={!selectedRoom || results.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600"
                  >
                    <Download size={16} /> Export to Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/50 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">User Name</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                      <th className="px-6 py-4 font-medium text-center">Total Score</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          <Loader2 size={32} className="mx-auto mb-4 animate-spin text-indigo-500" />
                          Loading results...
                        </td>
                      </tr>
                    ) : !selectedRoom ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          Select a room from the sidebar to view results.
                        </td>
                      </tr>
                    ) : results.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                          No students have completed the test in this room yet.
                        </td>
                      </tr>
                    ) : (
                      results.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-slate-800/30">
                          <td className="px-6 py-4 font-medium text-slate-200">{r.userName}</td>
                          <td className="px-6 py-4 text-slate-400">
                            {formatDate(r.createdAt)}
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
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setViewingResult(r)}
                                  className="rounded p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors"
                                  title="View Details"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  onClick={() => { setEditingId(r.id); setEditScore(r.total.toString()); }}
                                  className="rounded p-1 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 transition-colors"
                                  title="Edit Score"
                                >
                                  <Edit2 size={18} />
                                </button>
                              </div>
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
      </div>

      {/* View Result Modal */}
      {viewingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-6 py-4 backdrop-blur">
              <div>
                <h3 className="text-xl font-bold text-white">Result Details</h3>
                <p className="text-sm text-slate-400">{viewingResult.userName} • {formatDate(viewingResult.createdAt)}</p>
              </div>
              <button
                onClick={() => setViewingResult(null)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Score Summary */}
              <div className="flex flex-wrap gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 flex-1">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Total Score</p>
                  <p className="text-3xl font-bold text-indigo-400">{viewingResult.total}</p>
                </div>
              </div>

              {/* Essays */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Who Am I Essay</h4>
                <div className="rounded-xl bg-slate-950 p-4 border border-slate-800">
                  <p className="text-slate-300 whitespace-pre-wrap">{viewingResult.who_am_i?.original_text || "No essay submitted."}</p>
                  {viewingResult.who_am_i && (
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-300 border border-indigo-500/30">Initiative: {viewingResult.who_am_i.initiative}/1</span>
                      <span className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-300 border border-indigo-500/30">Problem Solving: {viewingResult.who_am_i.problem_solving}/1</span>
                      <span className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-300 border border-indigo-500/30">Goal Clarity: {viewingResult.who_am_i.goal_clarity}/1</span>
                      <span className="rounded bg-indigo-500/20 px-2 py-1 text-indigo-300 border border-indigo-500/30">Resource Awareness: {viewingResult.who_am_i.resource_awareness}/1</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Image Imagination */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Image Imagination Stories</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {viewingResult.images?.map((img, idx) => (
                    <div key={idx} className="rounded-xl bg-slate-950 p-4 border border-slate-800 flex flex-col justify-between">
                      <p className="text-slate-300 text-sm italic whitespace-pre-wrap mb-4">"{img.original_text || "No story submitted."}"</p>
                      <span className="self-start rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-400 border border-emerald-500/30">
                        Score: {img.total}/11
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Objective Answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="text-lg font-semibold text-white border-b border-slate-800 pb-2 mb-4">Section 1 (MCQ)</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingResult.section1?.map((ans, idx) => (
                      <div key={idx} className="flex flex-col items-center justify-center rounded bg-slate-800 p-2 text-xs w-12 border border-slate-700">
                        <span className="text-slate-500">Q{idx + 1}</span>
                        <span className="font-bold text-slate-200 uppercase">{ans || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white border-b border-slate-800 pb-2 mb-4">Section 2 (Paired)</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingResult.section2?.map((ans, idx) => (
                      <div key={idx} className="flex flex-col items-center justify-center rounded bg-slate-800 p-2 text-xs w-12 border border-slate-700">
                        <span className="text-slate-500">Q{idx + 1}</span>
                        <span className="font-bold text-slate-200 uppercase">{ans || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
