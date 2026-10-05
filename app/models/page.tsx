import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Modelos' };

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modelos</CardTitle>
        <CardDescription>Modelos cadastrados.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Sera implementado nas proximas etapas.</p>
      </CardContent>
    </Card>
  );
}