import { createFileRoute } from "@tanstack/react-router";
import SearchPage from "../components/SearchPage";

export const Route = createFileRoute("/search")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: String(search.q ?? ""),
	}),
	component: SearchRoute,
});

function SearchRoute() {
	const { q } = Route.useSearch();
	return <SearchPage query={q} />;
}
