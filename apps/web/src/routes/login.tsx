import { createFileRoute } from '@tanstack/react-router'
import {Text} from "@mantine/core";

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
    return (
        <>
        <Text>Hi</Text>
        </>
    )
}
