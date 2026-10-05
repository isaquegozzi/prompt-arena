/**
 * Development seed - example prompts only. No real API keys.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const examplePrompts = [
  {
    title: 'Resumo de texto',
    description: 'Resume um texto longo em bullet points concisos.',
    systemPrompt: 'Voce e um assistente especializado em resumir textos preservando suas ideias centrais.',
    content: 'Resuma o texto a seguir em ate 5 bullet points:\n\n{{texto}}',
    tags: 'resumo,extracao',
  },
  {
    title: 'Geracao de codigo',
    description: 'Gera uma funcao TypeScript a partir de uma descricao em linguagem natural.',
    systemPrompt: 'Voce e um engenheiro de software senior especializado em TypeScript.',
    content: 'Implemente uma funcao TypeScript que atenda a esta especificacao:\n\n{{especificacao}}',
    tags: 'codigo,typescript',
  },
  {
    title: 'Descricao de produto',
    description: 'Cria uma descricao comercial atraente para um produto.',
    systemPrompt: 'Voce e um especialista em marketing de conteudo.',
    content: 'Crie uma descricao comercial para o produto {{produto}} destacando seus principais beneficios.',
    tags: 'marketing,copy',
  },
  {
    title: 'Classificacao de sentimento',
    description: 'Classifica o sentimento de uma avaliacao como positivo, neutro ou negativo.',
    systemPrompt: 'Voce e um classificador de sentimento preciso.',
    content: 'Classifique o sentimento da avaliacao a seguir como POSITIVO, NEUTRO ou NEGATIVO. Justifique em uma frase.\n\n{{avaliacao}}',
    tags: 'classificacao,nlp',
  },
  {
    title: 'Extracao de dados',
    description: 'Extrai entidades estruturadas de um texto nao estruturado.',
    systemPrompt: 'Voce e um extrator de dados estruturado.',
    content: 'Extraia as entidades solicitadas do texto em formato JSON: {{entidades}}\n\nTexto: {{texto}}',
    tags: 'extracao,json',
  },
  {
    title: 'Resposta criativa',
    description: 'Gera uma resposta criativa a partir de um tema.',
    systemPrompt: 'Voce e um escritor criativo.',
    content: 'Escreva um paragrafo curto e criativo sobre o tema {{tema}}.',
    tags: 'criativo,escrita',
  },
];

async function main() {
  console.log('Seeding database...');
  await prisma.appSetting.deleteMany();
  await prisma.evaluation.deleteMany();
  await prisma.runResult.deleteMany();
  await prisma.run.deleteMany();
  await prisma.promptVariable.deleteMany();
  await prisma.prompt.deleteMany();
  await prisma.model.deleteMany();
  await prisma.provider.deleteMany();

  for (const p of examplePrompts) {
    const prompt = await prisma.prompt.create({ data: p });
    console.log(`Created prompt: ${prompt.title}`);
  }

  await prisma.appSetting.create({
    data: { key: 'onboarding.completed', value: 'false' },
  });
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });