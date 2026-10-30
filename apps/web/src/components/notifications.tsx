import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css"; // Required for toasts to show

export default function App() {
  return (
    <MantineProvider>
      <Notifications position="top-right" zIndex={2000} />
      {/* Your AppLayout and routes go here */}
    </MantineProvider>
  );
}