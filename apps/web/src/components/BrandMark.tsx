type BrandMarkProps = {
	className?: string;
};

export function BrandMark({ className = "size-6" }: BrandMarkProps) {
	return (
		<svg viewBox="0 0 64 64" aria-hidden="true" className={`text-base-content ${className}`}>
			{/* Lowercase k set in IBM Plex Sans Bold and converted to a vector outline. */}
			<path
				d="M22.002 54V11.08H30.586V36.426H30.934L34.704 30.8L40.794 23.55H50.306L40.156 35.208L51.466 54H41.258L34.414 41.124L30.586 45.416V54H22.002Z"
				fill="currentColor"
			/>
			<path d="M13 25H39" fill="none" stroke="currentColor" strokeWidth="6" />
		</svg>
	);
}
