import { Group, Paper, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { ChevronRight, Clock, Layers } from "lucide-react";
import { cardLabel, formatWorkedOn, fullDate } from "./formatters";
import type { FlashcardSet } from "./types";
import "./RecentSets.css";

type RecentSetCardProps = {
	set: FlashcardSet;
	onOpen: (set: FlashcardSet) => void;
};

export function RecentSetCard({ set, onOpen }: RecentSetCardProps) {
	return (
		<Paper
			component="button"
			type="button"
			withBorder
			className="rs-card"
			onClick={() => onOpen(set)}
		>
			<Text component="span" size="15px" fw={600} lh={1.3} lineClamp={2}>
				{set.name}
			</Text>
			<Group
				component="span"
				justify="space-between"
				gap={8}
				mt="auto"
				c="dimmed"
				fz={12}
			>
				<span>{cardLabel(set.cardCount)}</span>
				<Group component="span" gap={4} title={fullDate(set.lastWorkedOn)}>
					<Clock size={13} aria-hidden="true" />{" "}
					{formatWorkedOn(set.lastWorkedOn)}
				</Group>
			</Group>
			<ChevronRight size={18} className="rs-chevron" aria-hidden="true" />
		</Paper>
	);
}

type RecentSetsProps = {
	sets: FlashcardSet[];
	onOpen: (set: FlashcardSet) => void;
};

export default function RecentSets({ sets, onOpen }: RecentSetsProps) {
	return (
		<Stack component="section" gap={12} aria-labelledby="rs-title">
			<Title order={2} id="rs-title" fw={600}>
				Recent
			</Title>

			{sets.length > 0 ? (
				<SimpleGrid minColWidth="min(100%, 260px)" spacing={16}>
					{sets.map((set) => (
						<RecentSetCard key={set.id} set={set} onOpen={onOpen} />
					))}
				</SimpleGrid>
			) : (
				<SimpleGrid minColWidth="min(100%, 260px)" spacing={16}>
					{[0, 1, 2].map((i) => (
						<Paper
							key={i}
							withBorder
							bg="transparent"
							className="rs-card rs-card-empty"
							aria-hidden={i > 0}
						>
							{i === 0 ? (
								<Stack gap={8} align="center" c="dimmed" fz={13} ta="center">
									<Layers size={18} aria-hidden="true" />
									<span>No recently studied sets yet</span>
								</Stack>
							) : null}
						</Paper>
					))}
				</SimpleGrid>
			)}
		</Stack>
	);
}
