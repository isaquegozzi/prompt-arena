import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Sobre' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Sobre o Prompt Arena</CardTitle>
          <CardDescription>Projeto open source para testar e comparar prompts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Compare prompts, modelos, custos e latencia em uma unica interface. Suporte inicial para
            OpenAI, Anthropic, Gemini, endpoints compativeis com OpenAI e Ollama local.
          </p>
          <p>
            Estado atual: <strong className="text-foreground">Etapa 1 - Fundacao</strong>. Editor,
            comparacao paralela e integracoes serao adicionadas progressivamente.
          </p>
          <p>
            Licenciado sob a licenca MIT.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
