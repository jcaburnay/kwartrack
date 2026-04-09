import { findBank } from "../data/banks";

// Discover all SVG logos at build time. Files dropped into src/assets/banks/{id}.svg
// are automatically picked up — no code changes needed.
const bankSvgUrls = import.meta.glob<{ default: string }>("../assets/banks/*.svg", {
	eager: true,
	query: "?url",
});

function getBankSvgUrl(bankId: string): string | null {
	const key = `../assets/banks/${bankId}.svg`;
	return bankSvgUrls[key]?.default ?? null;
}

const MONOGRAM_COLORS = [
	"#2a9d8f",
	"#c47a3a",
	"#7b5ea7",
	"#4caf50",
	"#5b8fb9",
	"#e76f51",
	"#457b9d",
	"#e9c46a",
];

function deriveColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return MONOGRAM_COLORS[Math.abs(hash) % MONOGRAM_COLORS.length];
}

interface BankIconProps {
	bankId?: string | null;
	name: string;
	size?: number;
}

export function BankIcon({ bankId, name, size = 28 }: BankIconProps) {
	const bank = bankId ? findBank(bankId) : undefined;
	const svgUrl = bankId ? getBankSvgUrl(bankId) : null;

	const baseStyle: React.CSSProperties = {
		width: size,
		height: size,
		borderRadius: 7,
		flexShrink: 0,
		display: "inline-block",
	};

	if (svgUrl) {
		return (
			<img src={svgUrl} alt={bank?.name ?? name} style={{ ...baseStyle, objectFit: "contain" }} />
		);
	}

	const color = bank?.color ?? deriveColor(name);
	const abbr = bank?.abbr ?? name.slice(0, 2).toUpperCase();
	const fontSize = Math.max(9, Math.round(size * 0.35));

	return (
		<div
			style={{
				...baseStyle,
				background: color,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "white",
				fontSize,
				fontWeight: 700,
				fontFamily: "var(--font-sans, system-ui)",
				letterSpacing: "-0.02em",
			}}
		>
			{abbr}
		</div>
	);
}
