"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Receipt = {
  id: string;
  vendor: string | null;
  receipt_date: string | null;
  total_cents: number | null;
  status: string;
  created_at: string;
  approved_category: string | null;
  suggested_category: string | null;
  has_flags?: boolean;
};

type FilterType = 'all' | 'needs_review' | 'categorized' | 'uncategorized' | 'flagged';

export default function ReceiptsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    // Get filter from URL
    const status = searchParams.get('status');
    if (status === 'needs_review') {
      setActiveFilter('needs_review');
    }
  }, [searchParams]);

  useEffect(() => {
    loadReceipts();
  }, [activeFilter]);

  async function loadReceipts() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('firm_users')
        .select('firm_id')
        .eq('auth_user_id', user.id)  // FIXED: Changed from user_id to auth_user_id
        .single();

      if (!profile?.firm_id) {
        setLoading(false);
        return;
      }

      // Base query
      let query = supabase
        .from('receipts')
        .select('id, vendor, receipt_date, total_cents, status, created_at, approved_category, suggested_category')
        .eq('firm_id', profile.firm_id)
        .order('created_at', { ascending: false });

      const { data: receiptsData, error } = await query;
      
      console.log('🔍 Debug info:', {
        user: user.id,
        profile: profile,
        receiptsData: receiptsData,
        error: error,
        activeFilter: activeFilter
      });
      
      if (error) throw error;

      // Get flags for all receipts
      const { data: flagsData } = await supabase
        .from('receipt_flags')
        .select('receipt_id')
        .eq('firm_id', profile.firm_id)
        .is('resolved_at', null);

      const flaggedReceiptIds = new Set(flagsData?.map(f => f.receipt_id) || []);

      // Add flag indicator
      const receiptsWithFlags = (receiptsData || []).map(r => ({
        ...r,
        has_flags: flaggedReceiptIds.has(r.id)
      }));

      // Apply client-side filtering
      let filtered = receiptsWithFlags;
      
      switch (activeFilter) {
        case 'needs_review':
          filtered = receiptsWithFlags.filter(r => 
            !r.approved_category || r.has_flags
          );
          break;
        case 'categorized':
          filtered = receiptsWithFlags.filter(r => r.approved_category);
          break;
        case 'uncategorized':
          filtered = receiptsWithFlags.filter(r => !r.approved_category);
          break;
        case 'flagged':
          filtered = receiptsWithFlags.filter(r => r.has_flags);
          break;
        case 'all':
        default:
          filtered = receiptsWithFlags;
      }

      setReceipts(filtered);
    } catch (error: any) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }

  const filterButtons: { label: string; value: FilterType; icon: string }[] = [
    { label: 'All', value: 'all', icon: '📋' },
    { label: 'Needs Review', value: 'needs_review', icon: '⚠️' },
    { label: 'Categorized', value: 'categorized', icon: '✅' },
    { label: 'Uncategorized', value: 'uncategorized', icon: '❓' },
    { label: 'Flagged', value: 'flagged', icon: '🚩' },
  ];

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">Receipts</h1>
            <p className="text-sm text-gray-500 mt-1">
              {receipts.length} {activeFilter === 'all' ? 'total' : activeFilter.replace('_', ' ')} receipt{receipts.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {filterButtons.map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeFilter === filter.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.icon} {filter.label}
            </button>
          ))}
        </div>

        {/* Receipts List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading receipts...</div>
        ) : receipts.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed">
            <p className="text-gray-500">
              {activeFilter === 'all' 
                ? 'No receipts yet. Upload your first receipt to get started!'
                : `No ${activeFilter.replace('_', ' ')} receipts found.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receipts.map(receipt => (
              <Link
                key={receipt.id}
                href={`/dashboard/receipts/${receipt.id}`}
                className="block p-4 rounded-xl border hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {receipt.vendor || 'Unknown vendor'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {receipt.receipt_date || 'No date'}
                    </div>
                  </div>
                  
                  {receipt.has_flags && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                      🚩 Flagged
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-gray-900">
                    ${((receipt.total_cents || 0) / 100).toFixed(2)}
                  </div>
                  
                  {receipt.approved_category ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      ✓ {receipt.approved_category}
                    </span>
                  ) : receipt.suggested_category ? (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                      → {receipt.suggested_category}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                      Uncategorized
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}