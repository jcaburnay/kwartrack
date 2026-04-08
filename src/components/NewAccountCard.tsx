import { Plus } from "lucide-react";

interface NewAccountCardProps {
	onClick: () => void;
}

export function NewAccountCard({ onClick }: NewAccountCardProps) {
	return (
		<button
			type="button"
			className="border-2 border-dashed border-base-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors bg-transparent w-full h-full"
			onClick={onClick}
		>
			<div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center text-base-content/40">
				<Plus size={20} />
			</div>
			<span className="text-base-content/50 text-sm font-medium">New account</span>
		</button>
	);
}
