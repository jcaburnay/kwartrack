import { createBrowserRouter, RouterProvider } from "react-router";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { OverviewPage } from "./pages/OverviewPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<ProtectedRoute>
				<OverviewPage />
			</ProtectedRoute>
		),
	},
	{ path: "/signin", element: <SignInPage /> },
	{ path: "/signup", element: <SignUpPage /> },
]);

export function App() {
	return <RouterProvider router={router} />;
}
