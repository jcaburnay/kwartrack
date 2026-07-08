import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useVersion } from "./useTransactionVersion";

const INVALIDATES_ON: readonly ["transaction"] = ["transaction"];

export type TransactionMonthSummary = {
	netInflowCentavos: number;
	netOutflowCentavos: number;
	netCentavos: number;
	accountInflowCentavos: number;
	accountOutflowCentavos: number;
};

const emptySummary: TransactionMonthSummary = {
	netInflowCentavos: 0,
	netOutflowCentavos: 0,
	netCentavos: 0,
	accountInflowCentavos: 0,
	accountOutflowCentavos: 0,
};

type Params = {
	dateFrom: string;
	dateToExclusive: string;
	accountId: string | null;
};

export function useTransactionMonthSummary({ dateFrom, dateToExclusive, accountId }: Params) {
	const version = useVersion(INVALIDATES_ON);
	const requestSeq = useRef(0);
	const [summary, setSummary] = useState<TransactionMonthSummary>(emptySummary);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const refetch = useCallback(async () => {
		const seq = ++requestSeq.current;
		setIsLoading(true);
		setError(null);

		const { data, error: rpcError } = await supabase.rpc("transaction_month_summary", {
			p_date_from: dateFrom,
			p_date_to_exclusive: dateToExclusive,
			p_account_id: accountId ?? undefined,
		});

		if (seq !== requestSeq.current) return;

		if (rpcError) {
			setIsLoading(false);
			setError(rpcError.message);
			return;
		}

		const row = data?.[0];
		setSummary(
			row
				? {
						netInflowCentavos: row.net_inflow_centavos,
						netOutflowCentavos: row.net_outflow_centavos,
						netCentavos: row.net_centavos,
						accountInflowCentavos: row.account_inflow_centavos,
						accountOutflowCentavos: row.account_outflow_centavos,
					}
				: emptySummary,
		);
		setIsLoading(false);
	}, [dateFrom, dateToExclusive, accountId]);

	useEffect(() => {
		void version;
		void refetch();
	}, [refetch, version]);

	return { summary, isLoading, error, refetch };
}
