import { createFileRoute } from "@tanstack/react-router";
import GroupPage from "../components/GroupPage";

export const Route = createFileRoute("/groups/$groupId")({
	component: GroupRoute,
});

function GroupRoute() {
	const { groupId } = Route.useParams();
	return <GroupPage groupId={Number(groupId)} />;
}
