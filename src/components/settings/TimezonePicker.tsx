import { useEffect, useMemo, useRef, useState } from "react";

const FALLBACK_ZONES = [
	"UTC",
	"Asia/Manila",
	"Asia/Singapore",
	"Asia/Tokyo",
	"Asia/Shanghai",
	"Asia/Kolkata",
	"Asia/Dubai",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Madrid",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Sao_Paulo",
	"Australia/Sydney",
	"Pacific/Auckland",
	"Africa/Cairo",
	"Africa/Johannesburg",
];

function loadZones(): string[] {
	const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
	if (typeof intl.supportedValuesOf === "function") {
		try {
			return intl.supportedValuesOf("timeZone");
		} catch {
			// fall through
		}
	}
	return FALLBACK_ZONES;
}

function offsetFor(zone: string): string {
	try {
		const parts = new Intl.DateTimeFormat("en", {
			timeZone: zone,
			timeZoneName: "shortOffset",
		}).formatToParts(new Date());
		const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
		// shortOffset returns "GMT+8" style; normalise to "UTC+08:00"
		const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(offset);
		if (!m) return offset;
		const sign = m[1];
		const hh = m[2].padStart(2, "0");
		const mm = m[3] ?? "00";
		return `UTC${sign}${hh}:${mm}`;
	} catch {
		return "";
	}
}

type Entry = { zone: string; offset: string; haystack: string };

type TimezonePickerProps = {
	value: string;
	onChange: (next: string) => void;
};

export function TimezonePicker({ value, onChange }: TimezonePickerProps) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const containerRef = useRef<HTMLDivElement>(null);

	const entries = useMemo<Entry[]>(() => {
		const zones = loadZones();
		return zones.map((zone) => {
			const offset = offsetFor(zone);
			return {
				zone,
				offset,
				haystack: `${zone.toLowerCase()} ${offset.toLowerCase()}`.replace(/_/g, " "),
			};
		});
	}, []);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase().replace(/_/g, " ");
		if (!q) return entries.slice(0, 100);
		return entries.filter((e) => e.haystack.includes(q)).slice(0, 100);
	}, [entries, query]);

	useEffect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onDocClick);
		return () => document.removeEventListener("mousedown", onDocClick);
	}, [open]);

	const currentOffset = useMemo(() => offsetFor(value), [value]);

	return (
		<div ref={containerRef} className="relative w-full sm:w-72">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				className="input input-bordered input-sm w-full text-left flex items-center justify-between gap-2"
				aria-haspopup="listbox"
				aria-expanded={open}
			>
				<span className="truncate">{value.replace(/_/g, " ")}</span>
				<span className="text-xs text-base-content/50 shrink-0">{currentOffset}</span>
			</button>
			{open && (
				<div className="absolute z-30 mt-1 w-full bg-base-100 border border-base-300 rounded-box shadow-md flex flex-col">
					<div className="p-2 border-b border-base-300">
						<input
							autoFocus
							type="text"
							placeholder="Search (e.g. manila, +08, london)"
							className="input input-bordered input-sm w-full"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>
					<div role="listbox" className="max-h-64 overflow-y-auto py-1">
						{filtered.length === 0 ? (
							<div className="px-3 py-2 text-sm text-base-content/60">No matches.</div>
						) : (
							filtered.map((e) => (
								<button
									key={e.zone}
									type="button"
									role="option"
									aria-selected={e.zone === value}
									onClick={() => {
										onChange(e.zone);
										setOpen(false);
										setQuery("");
									}}
									className={`w-full flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-left hover:bg-base-200 ${
										e.zone === value ? "bg-base-200 font-medium" : ""
									}`}
								>
									<span className="truncate">{e.zone.replace(/_/g, " ")}</span>
									<span className="text-xs text-base-content/50 shrink-0 tabular-nums">
										{e.offset}
									</span>
								</button>
							))
						)}
					</div>
				</div>
			)}
		</div>
	);
}
