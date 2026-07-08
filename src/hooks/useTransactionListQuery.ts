import { useCallback, useEffect, useRef, useState } from "react";
import type { SortDir, SortKey } from "../components/transactions/TransactionsTable";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/supabase";
import type { TransactionFilters } from "../utils/transactionFilters";
import type { TransactionWithRecurring } from "./useTransactions";
import { useVersion } from "./useTransactionVersion";

const DEFAULT_PAGE_SIZE = 100;
const INVALIDATES_ON: readonly ["transaction", "account"] = ["transaction", "account"];

type TransactionListRpcRow = Database["public"]["Functions"]["transaction_list"]["Returns"][number];

type Params = {
	filters: TransactionFilters;
	search: string;
	sortKey: SortKey;
	sortDir: SortDir;
	pageSize?: number;
};

type State = {
	transactions: TransactionWithRecurring[];
	totalCount: number;
	isLoading: boolean;
	isLoadingMore: boolean;
	error: string | null;
};

const initialState: State = {
	transactions: [],
	totalCount: 0,
	isLoading: true,
	isLoadingMore: false,
	error: null,
};

function mapTransaction(row: TransactionListRpcRow): TransactionWithRecurring {
	const { recurring_service, total_count: _totalCount, ...tx } = row;
	return {
		...tx,
		recurring: recurring_service ? { service: recurring_service } : null,
	};
}

export function useTransactionListQuery({
	filters,
	search,
	sortKey,
	sortDir,
	pageSize = DEFAULT_PAGE_SIZE,
}: Params) {
	const version = useVersion(INVALIDATES_ON);
	const requestSeq = useRef(0);
	const [state, setState] = useState<State>(initialState);

	const fetchPage = useCallback(
		async (offset: number) => {
			const seq = ++requestSeq.current;
			const isFirstPage = offset === 0;
			setState((prev) =>
				isFirstPage
					? { ...prev, transactions: [], totalCount: 0, isLoading: true, error: null }
					: { ...prev, isLoadingMore: true, error: null },
			);

			const { data, error } = await supabase.rpc("transaction_list", {
				p_type: filters.type ?? undefined,
				p_tag_id: filters.tagId ?? undefined,
				p_account_id: filters.accountId ?? undefined,
				p_group_id: filters.groupId ?? undefined,
				p_date_from: filters.dateFrom ?? undefined,
				p_date_to: filters.dateTo ?? undefined,
				p_split_id: filters.splitId ?? undefined,
				p_debt_id: filters.debtId ?? undefined,
				p_search: search,
				p_sort_key: sortKey,
				p_sort_dir: sortDir,
				p_limit: pageSize,
				p_offset: offset,
			});

			if (seq !== requestSeq.current) return;

			if (error) {
				setState((prev) => ({
					...prev,
					isLoading: false,
					isLoadingMore: false,
					error: error.message,
				}));
				return;
			}

			const rows = data ?? [];
			const nextTransactions = rows.map(mapTransaction);
			const nextTotal = rows[0]?.total_count;

			setState((prev) => ({
				transactions: isFirstPage ? nextTransactions : [...prev.transactions, ...nextTransactions],
				totalCount: nextTotal ?? (isFirstPage ? 0 : prev.totalCount),
				isLoading: false,
				isLoadingMore: false,
				error: null,
			}));
		},
		[
			filters.type,
			filters.tagId,
			filters.accountId,
			filters.groupId,
			filters.dateFrom,
			filters.dateTo,
			filters.splitId,
			filters.debtId,
			search,
			sortKey,
			sortDir,
			pageSize,
		],
	);

	useEffect(() => {
		void version;
		void fetchPage(0);
	}, [fetchPage, version]);

	const refetch = useCallback(() => fetchPage(0), [fetchPage]);
	const loadMore = useCallback(
		() => fetchPage(state.transactions.length),
		[fetchPage, state.transactions.length],
	);

	return {
		...state,
		hasMore: state.transactions.length < state.totalCount,
		refetch,
		loadMore,
	};
}
