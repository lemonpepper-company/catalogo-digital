# Páginas Legais LGPD — Design Spec

**Data:** 2026-07-01  
**Status:** Aprovado

---

## Objetivo

Criar duas páginas estáticas públicas para cumprir a LGPD:
- `/politica-de-privacidade` — Política de Privacidade
- `/termos-de-uso` — Termos de Uso

Linkar ambas no footer da landing page.

---

## Controlador dos Dados

Identificado via CPF do responsável (armazenado fora deste documento por segurança).  
Nome do serviço: **Vtrine Digital**.

---

## Estrutura de Arquivos

```
app/
  politica-de-privacidade/
    page.tsx        → rota /politica-de-privacidade
  termos-de-uso/
    page.tsx        → rota /termos-de-uso
```

- Ambas são Server Components estáticas (sem `force-dynamic`, sem busca de dados)
- Herdam o root layout (`app/layout.tsx`) — fontes Sora + DM Sans, `lang="pt-BR"`
- Rotas públicas por padrão — não precisam de ajuste no middleware
- Conteúdo inline no JSX (sem arquivo de dados separado, sem MDX)

---

## Layout Visual

### Navbar
- Logo Vtrine à esquerda (link para `/landing`)
- Link `← Início` à direita, em DM Sans 14px `text-graphite`
- Mesma aparência da navbar da landing: `bg-ivory/[0.92] backdrop-blur border-b border-sand`

### Hero
- Etiqueta uppercase gold: ex. `LGPD · Atualizado em julho de 2026`
- H1 Sora 600, tamanho `text-[32px] md:text-[40px]`, cor obsidian
- Subtítulo DM Sans 16px graphite com a data de última atualização

### Corpo
- `max-w-[720px] mx-auto` centralizado, `bg-ivory`
- `px-4 sm:px-8`, `py-16 md:py-24`
- Seções separadas por `<h2>` Sora 500 20px + linha `border-b border-sand pb-3 mb-6`
- Parágrafos DM Sans 15px `text-graphite leading-relaxed`
- Listas `<ul>` com bullets `·` em gold

### Rodapé das páginas legais
- Rodapé mínimo (não o rodapé completo da landing — seria pesado demais)
- `border-t border-sand py-8`
- `© 2026 Vtrine Digital` + links `Política de Privacidade` e `Termos de Uso`
- DM Sans 13px `text-graphite`

---

## Conteúdo — Política de Privacidade

### 1. Quem somos
Identificação do controlador dos dados (Vtrine Digital, com CPF/nome do responsável), endereço de contato por email.

### 2. Dados que coletamos
- **Dados de conta:** nome completo, endereço de email, senha (hash gerenciado pelo Supabase)
- **Dados da loja:** nome da loja, slug público, número de WhatsApp, cor de destaque, logo, descrição, monograma
- **Dados de produtos:** nome, preço, descrição, tamanhos, cores, imagens (armazenadas no Supabase Storage)
- **Dados de uso:** plano contratado, data de criação da conta

### 3. Finalidade do tratamento
- Prestação do serviço contratado (criar e exibir catálogo público)
- Cobrança recorrente de assinatura
- Comunicações transacionais (confirmação de email, recuperação de senha)
- Melhoria e segurança do serviço

### 4. Base legal (LGPD Art. 7)
- **Execução de contrato** (inciso V): dados necessários para operar o serviço
- **Legítimo interesse** (inciso IX): segurança, prevenção de fraudes, melhoria do serviço
- **Consentimento** (inciso I): comunicações de marketing, se aplicável

### 5. Compartilhamento com terceiros
- **Supabase** (infraestrutura de banco de dados, autenticação e storage) — dados armazenados em servidores seguros
- **Processador de pagamento** (a ser definido — Stripe ou Pagar.me) — dados de cobrança
- Não vendemos dados a terceiros

### 6. Retenção de dados
- Dados mantidos enquanto a conta estiver ativa
- Após encerramento da conta: exclusão em até 30 dias, salvo obrigação legal de retenção

### 7. Direitos do titular
Nos termos da LGPD (Art. 18), o titular pode solicitar:
- Confirmação de tratamento
- Acesso aos dados
- Correção de dados incompletos ou desatualizados
- Anonimização, bloqueio ou eliminação
- Portabilidade
- Revogação do consentimento

Contato: email de suporte (a definir no momento da implementação).

---

## Conteúdo — Termos de Uso

### 1. Aceitação
O uso do serviço implica concordância com estes termos. Usuários menores de 18 anos devem ter autorização de responsável legal.

### 2. O serviço
A Vtrine Digital disponibiliza uma plataforma para que lojistas criem um catálogo público de produtos e recebam pedidos via WhatsApp. A plataforma não intermedia pagamentos nem é parte das negociações entre lojista e cliente final.

### 3. Cadastro e responsabilidades do lojista
- O lojista é responsável pela veracidade das informações cadastradas
- O lojista é responsável pelo conteúdo publicado (fotos, preços, descrições)
- É proibido publicar conteúdo ilegal, ofensivo ou que viole direitos de terceiros
- O lojista deve manter suas credenciais seguras

### 4. Planos e pagamento
- **Trial:** 14 dias gratuitos a partir do cadastro
- **Starter:** R$ 49/mês — limites de produtos e categorias conforme descrito na landing page
- **Pro:** R$ 99/mês — limites ampliados conforme descrito na landing page
- Cobrança recorrente mensal; cancelamento a qualquer momento

### 5. Suspensão e cancelamento
A Vtrine Digital pode suspender ou encerrar contas por:
- Inadimplência superior a 30 dias
- Publicação de conteúdo ilegal ou que viole estes termos
- Uso abusivo da plataforma (spam, automação não autorizada)

O lojista pode cancelar a qualquer momento pelo painel ou por email; dados serão excluídos conforme a Política de Privacidade.

### 6. Limitação de responsabilidade
A Vtrine Digital não se responsabiliza por:
- Negociações, pagamentos ou disputas entre lojista e cliente final
- Indisponibilidade temporária do serviço por manutenção ou falha de infraestrutura de terceiros
- Perdas indiretas decorrentes do uso ou impossibilidade de uso do serviço

### 7. Alterações nos termos
Podemos atualizar estes termos a qualquer momento, com aviso por email com antecedência mínima de 15 dias para alterações relevantes.

### 8. Foro
Fica eleito o foro do domicílio do contratante para dirimir quaisquer controvérsias, nos termos do Código de Defesa do Consumidor (Lei nº 8.078/1990).

---

## Footer da Landing — Alterações

Adicionar coluna **"Legal"** no grid do footer com links:
- `Política de Privacidade` → `/politica-de-privacidade`
- `Termos de Uso` → `/termos-de-uso`

Adicionar também na barra inferior (`© 2026 Vtrine Digital`):
- Links separados por `·` após o copyright: `Política de Privacidade · Termos de Uso`

---

## Fora de escopo

- Checkbox de consentimento no cadastro (decidido postergar)
- Página de Cookies (avaliar quando implementar Analytics/Pixel)
- Versão em inglês

---

## Critérios de aceitação

- [ ] `/politica-de-privacidade` renderiza corretamente em mobile e desktop
- [ ] `/termos-de-uso` renderiza corretamente em mobile e desktop
- [ ] Footer da landing linka ambas as páginas
- [ ] Metadata (`title`, `description`) definida em cada page
- [ ] Nenhuma rota de autenticação ou painel afetada
