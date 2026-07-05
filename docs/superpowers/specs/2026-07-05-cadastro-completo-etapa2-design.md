# Design — Cadastro completo na etapa 2

**Data:** 2026-07-05
**Status:** Aprovado, aguardando plano de implementação

## Contexto

Hoje `/cadastro?step=loja` (etapa 2, alcançada depois da confirmação de e-mail) pede apenas nome da loja, slug e Instagram. Todo o resto que define o perfil da loja — WhatsApp, logo, monograma, descrição, cor de destaque, formas de pagamento/entrega — só existe em `/painel/configuracoes`, editável depois. Isso significa que uma loja recém-criada nasce incompleta: sem WhatsApp (o checkout do catálogo público fica com o botão de finalizar pedido desabilitado até o lojista lembrar de configurar depois).

**Decisão:** trazer os campos de Configurações para a etapa 2 do cadastro — exceto "Mensagem do pedido", que continua exclusivo de Configurações — para que o lojista registre o essencial já no primeiro acesso.

## Estrutura da tela `/cadastro?step=loja`

```
Sua loja (existente, sem mudança)
  - Nome da loja (alimenta sugestão de slug)
  - Link da loja (slug)

Identidade (novo)
  - Logo (upload)
  - WhatsApp para pedidos (obrigatório nesta tela — diferente de Configurações, onde é opcional)
  - Monograma (até 3 letras, opcional)
  - Instagram (opcional) — substitui o campo solto que já existia
  - Descrição curta (opcional)

Cor de destaque (novo)
  - Paleta de cores + preview do CTA "Comprar via WhatsApp"

Pagamento e entrega (novo)
  - Formas de pagamento aceitas (Pix/Cartão/Dinheiro)
  - Formas de entrega (Retirar no local/Enviar no endereço)

[Salvar e continuar]
```

`/painel/configuracoes` não muda de comportamento — continua com todos esses campos mais "Mensagem do pedido", para edição posterior.

## Arquitetura: componentes e hook compartilhados

Para não duplicar a mesma UI e a mesma lógica de estado em duas telas, extraio:

**Componentes de apresentação** (`components/loja/`):
- `IdentidadeCard.tsx` — logo, WhatsApp, monograma, Instagram, descrição. **Não inclui nome da loja** — o campo "Nome da loja" continua tratado à parte em cada tela (em Configurações é solto; no cadastro, alimenta a sugestão de slug), já que o binding é diferente em cada contexto.
- `CorDestaqueCard.tsx` — paleta de cores + preview do CTA.
- `PagamentoEntregaCard.tsx` — toggles de pagamento e entrega.

Cada um recebe os valores e callbacks via props (sem buscar dados nem conhecer de onde vêm), seguindo a convenção do projeto de componentes de UI sem lógica própria.

**Hook compartilhado** (`components/loja/use-loja-fields.ts`, ao lado dos componentes que ele alimenta): centraliza o estado usado pelos três componentes acima: `whatsapp/setWhatsapp`, `monogram/setMonogram`, `description/setDescription`, `instagram/setInstagram`, `accent/setAccent`, `paymentMethods/togglePaymentMethod`, `deliveryMethods/toggleDeliveryMethod`, `logo/logoPreview/setLogo` (com compressão de imagem, já existente). Recebe como argumento os valores iniciais (de `StoreSettings` em Configurações, ou vazios/default no cadastro).

`useConfiguracoes` e o `useCadastroForm` (expandido) passam a compor esse hook internamente, cada um adicionando o que é específico da própria tela: `useConfiguracoes` mantém `msgTpl`/`MSG_VARS`/`textareaRef`/nome solto; `useCadastroForm` mantém nome+slug+dados de conta (etapa 1) e a wiring de submissão para `createStore`.

## `createStore` (Server Action)

`storeSchema` ganha os novos campos, com `whatsapp` obrigatório (`z.string().min(1, 'WhatsApp é obrigatório')` — diferente de `storeSettingsSchema`, onde é opcional) e os demais seguindo a mesma forma já usada em `storeSettingsSchema`: `monogram`, `description`, `accentColor`, `paymentMethods` (enum de `PAYMENT_METHOD_VALUES`), `deliveryMethods` (enum de `DELIVERY_METHOD_VALUES`).

Fluxo em duas fases por causa do logo (o caminho do arquivo no Storage usa o `id` da loja, que só existe depois do insert):

1. Valida os campos com `storeSchema`.
2. Insere a loja (sem logo) com todos os campos validados; se falhar (ex: slug duplicado), retorna erro como hoje — nada foi criado.
3. Se um arquivo de logo foi enviado, faz upload usando `uploadToBucket` (já existe, usado por `updateStoreSettings`) e atualiza `logo_url` na loja recém-criada.
4. Se o upload falhar nessa segunda fase, a loja já existe (passo 2 teve sucesso) — retorna um erro específico ("Loja criada, mas houve um problema ao enviar o logo. Você pode adicioná-lo depois em Configurações.") e **redireciona para `/painel`** mesmo assim, já que a loja em si foi criada com sucesso. Não há rollback do insert.

## Fora de escopo

- "Mensagem do pedido" continua exclusiva de Configurações.
- Nenhuma mudança em `updateStoreSettings`/`storeSettingsSchema` além de eventualmente importar os mesmos componentes de apresentação — a lógica de persistência de Configurações não muda.
- Google OAuth (`signInWithGoogle`) permanece fora de escopo, oculto na UI.

## Testes

- Os testes hoje embutidos em `ConfiguracoesClient.test.tsx` que cobrem os campos extraídos (Instagram, pagamento/entrega, WhatsApp/monograma/descrição) são adaptados para continuar passando através dos componentes compartilhados — sem perda de cobertura.
- Novo teste para `CadastroForm` cobrindo a etapa 2: presença dos novos cards, e que o WhatsApp é exigido (mensagem de erro quando vazio).
- Sem teste dedicado para o fluxo de upload de logo em duas fases dentro de `createStore` (mantém o padrão do projeto de não testar diretamente Server Actions que dependem de Supabase Storage) — coberto por verificação manual no plano de implementação.
