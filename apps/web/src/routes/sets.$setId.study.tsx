import { createFileRoute } from "@tanstack/react-router";
import StudyPage from "../components/StudyPage";

export const Route = createFileRoute("/sets/$setId/study")({
	component: StudyRoute,
});

function StudyRoute() {
	const { setId } = Route.useParams();
	return <StudyPage setId={Number(setId)} />;
}
