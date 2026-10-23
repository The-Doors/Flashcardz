import { createFileRoute } from "@tanstack/react-router";
import CommunityPage from "../components/ComunnityPage";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});