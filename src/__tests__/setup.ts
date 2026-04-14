import "@testing-library/jest-dom";

// jsdom does not implement HTMLDialogElement.showModal() — polyfill it
HTMLDialogElement.prototype.showModal = function () {
	this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
	this.removeAttribute("open");
	this.dispatchEvent(new Event("close"));
};

// Mock Clerk — auth tests are manual-only (see VALIDATION.md), but we need
// the imports to not crash in jsdom. All clerk hooks return safe defaults.
vi.mock("@clerk/react", () => ({
	ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
	// Show replaces SignedIn/SignedOut in Clerk v6. In tests, default to signed-in state.
	Show: ({ children, when }: { children: React.ReactNode; when: string }) =>
		when === "signed-in" ? children : null,
	SignIn: () => null,
	UserButton: () => null,
	useAuth: () => ({
		isLoaded: true,
		isSignedIn: false,
		getToken: async () => null,
	}),
	useClerk: () => ({
		signOut: async () => {},
		openUserProfile: () => {},
	}),
	useUser: () => ({
		isLoaded: true,
		isSignedIn: true,
		user: { fullName: "Test User", primaryEmailAddress: { emailAddress: "test@example.com" } },
	}),
}));

// Mock SpacetimeDB — no live connection in tests
vi.mock("spacetimedb/react", () => ({
	SpacetimeDBProvider: ({ children }: { children: React.ReactNode }) => children,
	useSpacetimeDB: () => ({ isActive: false, getConnection: () => null }),
	useTable: vi.fn(() => [[], true] as [unknown[], boolean]),
	useReducer: vi.fn(() => vi.fn()),
}));

// Mock generated module_bindings — prevents import errors in tests
vi.mock("../module_bindings", () => ({
	tables: {
		my_accounts: { name: "my_accounts" },
		my_sub_accounts: { name: "my_sub_accounts" },
		my_transactions: { name: "my_transactions" },
		my_recurring_definitions: { name: "my_recurring_definitions" },
		my_budget_config: { name: "my_budget_config" },
		my_budget_allocations: { name: "my_budget_allocations" },
		my_debts: { name: "my_debts" },
		my_tag_configs: { name: "my_tag_configs" },
	},
	reducers: {
		createAccount: { name: "create_account", accessorName: "createAccount" },
		renameAccount: { name: "rename_account", accessorName: "renameAccount" },
		deleteAccount: { name: "delete_account", accessorName: "deleteAccount" },
		addSubAccount: { name: "add_sub_account", accessorName: "addSubAccount" },
		convertAndCreateSubAccount: {
			name: "convert_and_create_sub_account",
			accessorName: "convertAndCreateSubAccount",
		},
		renameSubAccount: {
			name: "rename_sub_account",
			accessorName: "renameSubAccount",
		},
		editSubAccount: {
			name: "edit_sub_account",
			accessorName: "editSubAccount",
		},
		deleteSubAccount: {
			name: "delete_sub_account",
			accessorName: "deleteSubAccount",
		},
		createTransaction: {
			name: "create_transaction",
			accessorName: "createTransaction",
		},
		editTransaction: {
			name: "edit_transaction",
			accessorName: "editTransaction",
		},
		deleteTransaction: {
			name: "delete_transaction",
			accessorName: "deleteTransaction",
		},
		createRecurringDefinition: {
			name: "create_recurring_definition",
			accessorName: "createRecurringDefinition",
		},
		editRecurringDefinition: {
			name: "edit_recurring_definition",
			accessorName: "editRecurringDefinition",
		},
		deleteRecurringDefinition: {
			name: "delete_recurring_definition",
			accessorName: "deleteRecurringDefinition",
		},
		pauseRecurringDefinition: {
			name: "pause_recurring_definition",
			accessorName: "pauseRecurringDefinition",
		},
		resumeRecurringDefinition: {
			name: "resume_recurring_definition",
			accessorName: "resumeRecurringDefinition",
		},
		setBudget: { name: "set_budget", accessorName: "setBudget" },
		setBudgetAllocations: { name: "set_budget_allocations", accessorName: "setBudgetAllocations" },
		createDebt: { name: "create_debt", accessorName: "createDebt" },
		deleteDebt: { name: "delete_debt", accessorName: "deleteDebt" },
		addCustomTag: { name: "add_custom_tag", accessorName: "addCustomTag" },
		deleteCustomTag: { name: "delete_custom_tag", accessorName: "deleteCustomTag" },
		toggleTagVisibility: { name: "toggle_tag_visibility", accessorName: "toggleTagVisibility" },
		createTimeDeposit: { name: "create_time_deposit", accessorName: "createTimeDeposit" },
		editTimeDepositMetadata: {
			name: "edit_time_deposit_metadata",
			accessorName: "editTimeDepositMetadata",
		},
	},
	DbConnection: {
		builder: vi.fn(() => ({
			withUri: vi.fn().mockReturnThis(),
			withDatabaseName: vi.fn().mockReturnThis(),
			withToken: vi.fn().mockReturnThis(),
			onConnect: vi.fn().mockReturnThis(),
			onDisconnect: vi.fn().mockReturnThis(),
			build: vi.fn(),
		})),
	},
}));
