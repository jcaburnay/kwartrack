import { Plus } from "lucide-react";

interface NewItemCardProps {
	label: string;
	onClick: () => void;
}

export function NewItemCard({ label, onClick }: NewItemCardProps) {
	return (
		<button
			type="button"
			className="border-2 border-dashed border-base-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2.5 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors bg-transparent w-full h-full"
			onClick={onClick}
		>
			<div className="w-8 h-8 rounded-lg bg-base-200 flex items-center justify-center text-base-content/60">
				<Plus size={16} />
			</div>
			<span className="text-base-content/60 text-sm font-medium">{label}</span>
		</button>
	);
}
