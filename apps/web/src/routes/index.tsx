import {createFileRoute, useNavigate} from '@tanstack/react-router'
import {Anchor, AppShell, Button, Group, Stack, Text, Title} from '@mantine/core'

export const Route = createFileRoute('/')({ component: App })

function App() {
    const navigate = useNavigate()
  return (
          <Group justify="center" pt="sm">
          <Stack>
              <Title>Sup Bruh</Title>
              <Button size="sm" onClick={() => navigate({to: '/login'})}>Login</Button>
          </Stack>
          </Group>
  )
}
