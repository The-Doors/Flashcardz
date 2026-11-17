import { Button, Group, Modal, Text } from "@mantine/core";
import { cardLabel } from "./formatters";
import type { FlashcardSet } from "./types";

type ConfirmDeleteProps = {
	set: FlashcardSet;
	onCancel: () => void;
	onConfirm: () => void;
};

export default function ConfirmDelete({
	set,
	onCancel,
	onConfirm,
}: ConfirmDeleteProps) {
	return (
		<Modal
			opened
			onClose={onCancel}
			title="Delete this set?"
			size={400}
			role="alertdialog"
			aria-describedby="cd-desc"
		>
			<Text id="cd-desc">
				“{set.name}” and its {cardLabel(set.cardCount)} will be permanently
				deleted. This can’t be undone.
			</Text>
			<Group justify="flex-end" gap={8} mt={20}>
				<Button data-autofocus variant="default" onClick={onCancel}>
					Cancel
				</Button>
				<Button color="red" onClick={onConfirm}>
					Delete set
				</Button>
			</Group>
		</Modal>
	);
}
