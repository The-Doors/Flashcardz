import { createFileRoute } from "@tanstack/react-router";
import CreatePage from "../components/CreatePage";

export const Route = createFileRoute("/sets/$setId/edit")({
	component: EditSetRoute,
});

function EditSetRoute() {
	const { setId } = Route.useParams();
	return <CreatePage key={setId} setId={Number(setId)} />;
}
