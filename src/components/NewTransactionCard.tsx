import { Plus } from "lucide-react";

interface NewTransactionCardProps {
	onClick: () => void;
}

export function NewTransactionCard({ onClick }: NewTransactionCardProps) {
	return (
		<button
			type="button"
			className="border-2 border-dashed border-base-300 rounded-xl py-3 px-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors bg-transparent w-full"
			onClick={onClick}
		>
			<Plus size={16} className="text-base-content/40" />
			<span className="text-base-content/50 text-sm font-medium">New transaction</span>
		</button>
	);
}
