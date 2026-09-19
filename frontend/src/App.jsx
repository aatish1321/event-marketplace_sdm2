import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Event Marketplace</CardTitle>
          <CardDescription>Testing the new frontend stack.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            If this looks like a clean, properly styled card, Tailwind and shadcn are fully operational!
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full">Get Started</Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default App
