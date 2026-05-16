import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, ShieldAlert, Loader2, RefreshCw, CheckCircle, XCircle, X, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import { API_URL } from './config';
import { authHeaders } from './lib/authHeaders';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', tone: 'bg-amber-100 text-amber-800' },
  { value: 'approved', label: 'Approved', tone: 'bg-green-100 text-green-800' },
  { value: 'rejected', label: 'Rejected', tone: 'bg-red-100 text-red-800' },
];

const VerificationQueue = () => {
  const [statusFilter, setStatusFilter] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // user being reviewed
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API_URL}/api/v1/admin/verifications?status=${statusFilter}`, { headers });
      if (!r.ok) throw new Error('Failed to load');
      setUsers(await r.json());
    } catch (e) {
      toast.error('Could not load verification queue.');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openReview = async (user) => {
    setSelected(user);
    setDetail(null);
    setDetailLoading(true);
    setRejectMode(false);
    setRejectReason('');
    try {
      const headers = await authHeaders();
      const r = await fetch(`${API_URL}/api/v1/admin/verifications/${user.id}`, { headers });
      if (!r.ok) throw new Error('Failed to load detail');
      setDetail(await r.json());
    } catch {
      toast.error('Could not load this submission.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeReview = () => {
    setSelected(null);
    setDetail(null);
    setRejectMode(false);
    setRejectReason('');
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const headers = await authHeaders({ 'Content-Type': 'application/json' });
      const r = await fetch(`${API_URL}/api/v1/admin/verifications/${selected.id}/approve`, {
        method: 'POST',
        headers,
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'approve_failed');
      }
      toast.success(`Approved ${selected.agency_id}.`);
      closeReview();
      fetchList();
    } catch (e) {
      toast.error(`Approve failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    if (!rejectReason.trim()) {
      toast.warn('Please provide a rejection reason.');
      return;
    }
    setBusy(true);
    try {
      const headers = await authHeaders({ 'Content-Type': 'application/json' });
      const r = await fetch(`${API_URL}/api/v1/admin/verifications/${selected.id}/reject`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'reject_failed');
      }
      toast.success(`Rejected ${selected.agency_id}.`);
      closeReview();
      fetchList();
    } catch (e) {
      toast.error(`Reject failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={22} className="text-blue-700" />
          <h2 className="text-xl font-bold text-gray-800">Civilian Verification Queue</h2>
        </div>
        <button
          onClick={fetchList}
          className="text-gray-500 hover:text-blue-600 flex items-center gap-1 text-sm"
          title="Refresh"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
              statusFilter === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No {statusFilter} submissions.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const tone = STATUS_OPTIONS.find(o => o.value === u.id_verification_status)?.tone || 'bg-gray-100 text-gray-700';
                return (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-blue-50/40">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{u.agency_id}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {u.id_submitted_at ? new Date(u.id_submitted_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tone}`}>
                        {u.id_verification_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openReview(u)}
                        className="text-blue-600 hover:text-blue-800 font-bold text-xs"
                      >
                        Review →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">{selected.full_name || selected.agency_id}</h3>
                <p className="text-xs text-gray-500">{selected.agency_id}</p>
              </div>
              <button onClick={closeReview} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              {detailLoading ? (
                <div className="py-10 text-center text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Loading documents...
                </div>
              ) : detail ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Government ID</div>
                      {detail.id_document_url ? (
                        <a href={detail.id_document_url} target="_blank" rel="noreferrer">
                          <img src={detail.id_document_url} alt="ID" className="rounded-lg w-full max-h-72 object-contain bg-gray-100 border border-gray-200" />
                        </a>
                      ) : <div className="text-sm text-gray-400">Not available</div>}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-500 uppercase mb-2">Selfie</div>
                      {detail.selfie_url ? (
                        <a href={detail.selfie_url} target="_blank" rel="noreferrer">
                          <img src={detail.selfie_url} alt="Selfie" className="rounded-lg w-full max-h-72 object-contain bg-gray-100 border border-gray-200" />
                        </a>
                      ) : <div className="text-sm text-gray-400">Not available</div>}
                    </div>
                  </div>

                  {detail.id_verification_status === 'rejected' && detail.id_rejection_reason && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                      <strong>Previous rejection:</strong> {detail.id_rejection_reason}
                    </div>
                  )}

                  {rejectMode ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-bold text-gray-700">Reason for rejection</label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        rows={3}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-red-500 outline-none text-sm"
                        placeholder="e.g. ID is blurry or doesn't match the selfie"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => { setRejectMode(false); setRejectReason(''); }}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={reject}
                          disabled={busy}
                          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center gap-2"
                        >
                          {busy ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                          Confirm reject
                        </button>
                      </div>
                    </div>
                  ) : detail.id_verification_status === 'pending' ? (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setRejectMode(true)}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold flex items-center gap-2"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                      <button
                        onClick={approve}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold flex items-center gap-2"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        Approve
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic text-right">
                      Already decided ({detail.id_verification_status}).
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-red-600">Failed to load.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationQueue;
