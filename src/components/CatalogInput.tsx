import { useEffect, useMemo, useState } from "react";
import { type CatalogEntry, filterCatalog, getLogoUrl } from "../utils/subscriptionCatalog";
import { FormField, inputCls } from "./FormField";

interface CatalogInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onSelect"> {
	label: string;
	error?: string;
	filterValue: string;
	onSelect: (name: string) => void;
	suggestionsEnabled?: boolean;
}

export function CatalogInput({
	label,
	id,
	error,
	filterValue,
	onSelect,
	suggestionsEnabled = true,
	onChange,
	onFocus,
	onBlur,
	onKeyDown,
	...inputProps
}: CatalogInputProps) {
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);

	const suggestions = useMemo(
		() => (suggestionsEnabled ? filterCatalog(filterValue) : []),
		[filterValue, suggestionsEnabled],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setActiveIndex is a setState function and never changes
	useEffect(() => {
		setActiveIndex(-1);
	}, [filterValue, suggestionsEnabled]);

	return (
		<FormField label={label} id={id ?? ""} error={error}>
			<div className={`dropdown w-full${open && suggestions.length > 0 ? " dropdown-open" : ""}`}>
				<input
					id={id}
					className={inputCls(error)}
					onChange={(e) => {
						setOpen(true);
						onChange?.(e);
					}}
					onFocus={(e) => {
						setOpen(true);
						onFocus?.(e);
					}}
					onBlur={(e) => {
						setTimeout(() => setOpen(false), 150);
						onBlur?.(e);
					}}
					onKeyDown={(e) => {
						if (open && suggestions.length > 0) {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
							} else if (e.key === "ArrowUp") {
								e.preventDefault();
								setActiveIndex((i) => Math.max(i - 1, -1));
							} else if (e.key === "Enter" && activeIndex >= 0) {
								e.preventDefault();
								onSelect(suggestions[activeIndex].name);
								setOpen(false);
								setActiveIndex(-1);
							} else if (e.key === "Escape") {
								setOpen(false);
								setActiveIndex(-1);
							}
						}
						onKeyDown?.(e);
					}}
					{...inputProps}
				/>
				{open && suggestions.length > 0 && (
					<ul className="dropdown-content menu bg-base-100 rounded-box z-50 w-full shadow-lg p-0">
						{suggestions.map((entry: CatalogEntry, idx: number) => (
							<li key={entry.domain + entry.name}>
								<button
									type="button"
									className={`text-sm${idx === activeIndex ? " active" : ""}`}
									onMouseDown={(e) => {
										e.preventDefault();
										onSelect(entry.name);
										setOpen(false);
										setActiveIndex(-1);
									}}
									onMouseEnter={() => setActiveIndex(idx)}
								>
									<img
										src={getLogoUrl(entry.domain)}
										alt=""
										className="w-5 h-5 rounded-sm flex-shrink-0 object-contain"
										onError={(e) => {
											e.currentTarget.style.display = "none";
										}}
									/>
									{entry.name}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</FormField>
	);
}
