import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Users, CreditCard, Activity, Loader2, Edit2, Check } from 'lucide-react';

export function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editCredits, setEditCredits] = useState<number>(0);

  useEffect(() => {
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(100)));
        const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(usersList);

        const paymentsSnap = await getDocs(query(collection(db, 'payments'), orderBy('created_at', 'desc'), limit(50)));
        const paymentsList = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPayments(paymentsList);
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isOfflineError = errMsg.includes('offline') || errMsg.includes('Backend didn\'t respond') || errMsg.includes('Could not reach') || errMsg.includes('10 seconds');
        if (isOfflineError) {
          console.warn("Failed to fetch admin data (client offline):", errMsg);
        } else {
          console.error("Failed to fetch admin data:", err);
        }
      }
      setLoading(false);
    };

    fetchAdminData();
  }, []);

  const handleUpdateCredits = async (userId: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        available_credits: editCredits
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, available_credits: editCredits } : u));
      setEditingUserId(null);
    } catch (err) {
      console.error("Failed to update credits:", err);
      alert("Failed to update credits. Check permissions.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-blue-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-500 uppercase tracking-widest">Total Users</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{users.length}</p>
          </div>
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-gray-500">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-500 uppercase tracking-widest">Total Payments</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{payments.length}</p>
          </div>
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-yellow-500">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-500 uppercase tracking-widest">Revenue (INR)</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              ₹{payments.reduce((acc, curr) => acc + (curr.amount || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center text-yellow-600">
            <Activity className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Users Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-white">
            <h2 className="text-lg font-bold text-gray-900">User Client Base</h2>
            <p className="text-sm text-blue-500 mt-1">Recently active registered logins</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/50">
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Role</th>
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 break-all">{user.email || 'Anonymous'}</td>
                    <td className="px-6 py-4 text-sm text-blue-500">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'admin' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-50 text-blue-600'
                      }`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600">
                      {editingUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="w-16 px-2 py-1 text-sm border border-blue-300 rounded-md focus:outline-none focus:border-yellow-500 font-mono"
                            value={editCredits}
                            onChange={(e) => setEditCredits(parseInt(e.target.value) || 0)}
                            autoFocus
                          />
                          <button onClick={() => handleUpdateCredits(user.id)} className="p-1 hover:bg-yellow-100 text-yellow-600 rounded-md transition-colors">
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 font-mono group">
                          {user.available_credits ?? 0}
                          <button 
                            onClick={() => { setEditingUserId(user.id); setEditCredits(user.available_credits ?? 0); }}
                            className="p-1 hover:bg-blue-200 text-gray-500 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                            title="Edit Credits"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-blue-500">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments Ledger */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-white">
            <h2 className="text-lg font-bold text-gray-900">Payments Ledger</h2>
            <p className="text-sm text-blue-500 mt-1">Latest successful transactions</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/50">
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Order ID</th>
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Amount</th>
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-blue-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-100">
                {payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-blue-500">{payment.id.split('_').pop()}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-800">₹{payment.amount}</td>
                    <td className="px-6 py-4 text-sm text-blue-500">
                      {payment.created_at?.toDate ? new Date(payment.created_at.toDate()).toLocaleDateString() : 'Just now'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-50 border border-yellow-100 text-[10px] font-bold text-yellow-600 uppercase tracking-wider">
                        <span className="w-1 h-1 rounded-full bg-yellow-500"></span>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-sm text-blue-500">No payments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
