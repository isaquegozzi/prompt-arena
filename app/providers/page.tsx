import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Provedores' };

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provedores</CardTitle>
        <CardDescription>Configure provedores de IA.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Sera implementado nas proximas etapas.</p>
      </CardContent>
    </Card>
  );
}