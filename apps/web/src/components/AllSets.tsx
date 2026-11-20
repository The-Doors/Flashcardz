import {
	ActionIcon,
	Badge,
	Box,
	Group,
	Paper,
	Stack,
	Text,
	Title,
	UnstyledButton,
} from "@mantine/core";
import { Pencil, Trash2 } from "lucide-react";
import { cardLabel, formatWorkedOn, fullDate } from "./formatters";
import type { FlashcardSet } from "./types";
import "./AllSets.css";

type SetRowProps = {
	set: FlashcardSet;
	onOpen: (set: FlashcardSet) => void;
	onEdit: (set: FlashcardSet) => void;
	onRequestDelete: (set: FlashcardSet) => void;
};

export function SetRow({ set, onOpen, onEdit, onRequestDelete }: SetRowProps) {
	return (
		<Box component="li" className="as-row">
			<UnstyledButton className="as-row-main" onClick={() => onOpen(set)}>
				<span className="as-row-name">{set.name}</span>
				<span className="as-row-date" title={fullDate(set.lastWorkedOn)}>
					{formatWorkedOn(set.lastWorkedOn)}
				</span>
				<span className="as-row-cards">{cardLabel(set.cardCount)}</span>
			</UnstyledButton>

			<Group gap={4} wrap="nowrap" className="as-row-actions">
				<ActionIcon
					variant="subtle"
					color="gray"
					onClick={() => onEdit(set)}
					aria-label={`Edit ${set.name}`}
					title="Edit"
				>
					<Pencil size={16} />
				</ActionIcon>
				<ActionIcon
					variant="subtle"
					color="red"
					onClick={() => onRequestDelete(set)}
					aria-label={`Delete ${set.name}`}
					title="Delete"
				>
					<Trash2 size={16} />
				</ActionIcon>
			</Group>
		</Box>
	);
}

type AllSetsProps = {
	sets: FlashcardSet[];
	onOpen: (set: FlashcardSet) => void;
	onEdit: (set: FlashcardSet) => void;
	onRequestDelete: (set: FlashcardSet) => void;
};

export default function AllSets({
	sets,
	onOpen,
	onEdit,
	onRequestDelete,
}: AllSetsProps) {
	return (
		<Stack component="section" gap={12} aria-labelledby="as-title">
			<Group gap={8}>
				<Title order={2} id="as-title" fw={600}>
					All sets
				</Title>
				<Badge variant="light" color="gray" size="sm">
					{sets.length}
				</Badge>
			</Group>

			<Paper withBorder className="as-list">
				<div className="as-list-head" aria-hidden="true">
					<span>Name</span>
					<span>Last worked on</span>
					<span>Cards</span>
				</div>

				{sets.length > 0 ? (
					<ul>
						{sets.map((set) => (
							<SetRow
								key={set.id}
								set={set}
								onOpen={onOpen}
								onEdit={onEdit}
								onRequestDelete={onRequestDelete}
							/>
						))}
					</ul>
				) : (
					<Text c="dimmed" ta="center" py={32} px={16}>
						No flashcard sets found. Create your first set to get started!
					</Text>
				)}
			</Paper>
		</Stack>
	);
}
