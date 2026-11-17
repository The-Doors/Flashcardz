import {
	Container,
	type ContainerProps,
	Stack,
	type StackProps,
	Text,
} from "@mantine/core";

export default function PageLayout({
	children,
	size = 900,
	fluid,
	gap = 24,
}: Pick<ContainerProps, "children" | "size" | "fluid"> &
	Pick<StackProps, "gap">) {
	return (
		<Container size={size} fluid={fluid} px={0} pb={60}>
			<Stack gap={gap}>{children}</Stack>
		</Container>
	);
}

export function PageMessage({
	children,
	role,
}: {
	children: React.ReactNode;
	role?: "alert";
}) {
	return (
		<Text c="dimmed" ta="center" my={40} role={role}>
			{children}
		</Text>
	);
}
