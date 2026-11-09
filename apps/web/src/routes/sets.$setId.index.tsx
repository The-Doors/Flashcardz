import { createFileRoute } from "@tanstack/react-router";
import SetPage from "../components/SetPage";

export const Route = createFileRoute("/sets/$setId/")({
	component: SetRoute,
});

function SetRoute() {
	const { setId } = Route.useParams();
	return <SetPage setId={Number(setId)} />;
}
