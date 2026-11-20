import { notifications } from "@mantine/notifications";

/** Logs the error and shows its message, which the API helpers make readable. */
export function notifyError(error: unknown, fallback: string) {
	console.error(error);
	notifications.show({
		color: "red",
		message: error instanceof Error ? error.message : fallback,
	});
}
