# Marcar tamanho como esgotado (painel de produtos)

**Data:** 2026-07-03
**Status:** Aprovado para planejamento

## Objetivo

O catálogo público já suporta marcar tamanhos individuais como esgotados: em [ProductDetail.tsx:207-217](../../../components/catalogo/ProductDetail.tsx#L207-L217), tamanhos presentes em `product.soldSizes` aparecem riscados e desabilitados para o cliente. O campo `soldSizes` também já é lido e persistido pelo backend ([produtos.ts:94-95,173-174](../../../app/actions/produtos.ts#L94-L95)) e já existe no estado do formulário ([use-produto-form.ts:28](../../../app/painel/produtos/use-produto-form.ts#L28)). O que falta é a interface: hoje o lojista não tem nenhum controle no painel para marcar um tamanho como esgotado — o `ChipEditor` usado na seção "Variações" só permite adicionar/remover tamanhos, não alternar disponibilidade.

O objetivo desta rodada é expor esse controle no formulário de cadastro/edição de produto (`ProdutoFormClient.tsx`).

## Escopo

**Dentro:**
- UI no `ChipEditor` (seção "Variações" → "Tamanhos") para alternar um tamanho entre disponível/esgotado.
- Sincronização: remover um tamanho da lista também o remove de `soldSizes`, evitando estado inconsistente.
- Estilo visual do chip esgotado consistente com o que o cliente já vê no catálogo.

**Fora desta rodada:**
- Qualquer mudança de backend/persistência — já está pronto.
- Controle de estoque numérico por tamanho (quantidade) — o modelo atual é binário (esgotado/disponível), isso não muda.
- Mudanças no `ColorEditor` ou em qualquer outra variação além de tamanhos.

## Estratégia

Mudança isolada em `app/painel/produtos/ProdutoFormClient.tsx`. Sem novas dependências, sem mudanças de schema ou de server actions.

### `ChipEditor`

Passa a aceitar duas props novas, opcionais (mantendo o componente reutilizável caso outro chamador apareça no futuro sem essa necessidade):

```ts
soldItems?: string[];
onToggleSold?: (item: string) => void;
```

Cada chip é dividido em duas áreas de clique independentes:
- **Clique no texto do tamanho** → chama `onToggleSold(item)`, alternando esgotado/disponível. Só ativo quando `onToggleSold` é passado.
- **Clique no X** → continua removendo o item da lista (comportamento atual, inalterado).

Quando o item está em `soldItems`, o chip troca o estilo padrão (`bg-linen border-sand text-obsidian`) para o estilo "esgotado": `line-through text-inactive border-sand`, mesmo idioma visual do chip desabilitado em [ProductDetail.tsx:216-217](../../../components/catalogo/ProductDetail.tsx#L216-L217).

### `ProdutoFormClient`

A chamada do `ChipEditor` para tamanhos passa a incluir:

```tsx
<ChipEditor
  title="Tamanhos"
  items={f.sizes}
  setItems={(items) => {
    f.setSizes(items);
    f.setSoldSizes(f.soldSizes.filter((s) => items.includes(s)));
  }}
  soldItems={f.soldSizes}
  onToggleSold={(size) =>
    f.setSoldSizes(
      f.soldSizes.includes(size)
        ? f.soldSizes.filter((s) => s !== size)
        : [...f.soldSizes, size]
    )
  }
/>
```

O `setItems` passado ganha a lógica de limpeza: sempre que a lista de tamanhos muda (remoção), filtra `soldSizes` para manter só tamanhos que ainda existem.

## Testes

- Teste manual no painel: cadastrar/editar produto, marcar um tamanho como esgotado, salvar, reabrir o produto e confirmar que o estado persiste.
- Teste manual no catálogo público: confirmar que o tamanho marcado aparece riscado/bloqueado para o cliente (fluxo já existente, sem mudança — serve como verificação de integração ponta a ponta).
- Sem testes automatizados novos: é uma mudança de UI local sem lógica de negócio nova (a lógica de leitura/gravação de `soldSizes` já é coberta pelos testes existentes do backend).
