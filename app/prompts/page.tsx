import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Biblioteca de Prompts' };

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Biblioteca de Prompts</CardTitle>
        <CardDescription>Prompts salvos.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Sera implementado nas proximas etapas.</p>
      </CardContent>
    </Card>
  );
}