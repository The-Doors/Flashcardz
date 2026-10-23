import { createFileRoute } from "@tanstack/react-router";
import GroupsPage from "../components/GroupsPage";

export const Route = createFileRoute("/groups")({
  component: GroupsPage,
});