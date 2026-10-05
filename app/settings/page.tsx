import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Configuracoes' };

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuracoes</CardTitle>
        <CardDescription>Preferencias locais.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Sera implementado nas proximas etapas.</p>
      </CardContent>
    </Card>
  );
}