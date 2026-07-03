# Contract: pt-BR copy (shell + system states)

**Feature**: `003-app-shell-and-ds` · Source for the `shared/i18n/messages.pt-br.ts` keys added by this slice.
All copy is Brazilian Portuguese and **honest**: no payment-provider name, no cancellation policy, no price
(FR-014, Principle II). Existing `001` keys (auth/calculator/account/theme) are reused unchanged.

## Navigation (app-nav)

| Key                | pt-BR                     |
|--------------------|---------------------------|
| `nav.calcular`     | Calcular                  |
| `nav.catalogo`     | Catálogo                  |
| `nav.historico`    | Histórico                 |
| `nav.conta`        | Conta                     |

## Conta page

| Key                    | pt-BR                                          |
|------------------------|------------------------------------------------|
| `conta.title`          | Conta                                          |
| `conta.planLabel`      | Plano                                          |
| `conta.planFree`       | Gratuito                                        |
| `conta.themeLabel`     | Tema                                            |
| (reuse) `account.signOut` | Sair                                        |
| (reuse) `account.signedInAs` | Conectado como                           |

## Placeholders (Catálogo / Histórico)

| Key                        | pt-BR                                                         |
|----------------------------|--------------------------------------------------------------|
| `catalogo.emptyTitle`      | Catálogo em breve                                            |
| `catalogo.emptyBody`       | Aqui você vai salvar filamentos, impressoras e produtos.     |
| `historico.emptyTitle`     | Histórico em breve                                           |
| `historico.emptyBody`      | Seus cálculos salvos vão aparecer aqui.                      |

> Placeholder copy states intent without promising Premium mechanics, price, or dates (honest, out-of-scope-safe).

## System states

| Key                     | pt-BR                                                            |
|-------------------------|-----------------------------------------------------------------|
| `state.offline`         | Você está offline. O cálculo continua funcionando.              |
| `notFound.title`        | Página não encontrada                                           |
| `notFound.body`         | O endereço que você abriu não existe.                          |
| `notFound.back`         | Voltar para Calcular                                           |
| `error.title`           | Algo deu errado                                                |
| `error.body`            | Tente novamente. Se persistir, informe o código de suporte.    |
| `error.reload`          | Recarregar                                                      |
| `error.supportCode`     | Código de suporte:                                             |

## Error-code → friendly pt-BR (map consumed by toaster/alerts)

| `ErrorCode` (wire union) | pt-BR message (indicative — finalized against the generated union) |
|--------------------------|--------------------------------------------------------------------|
| unauthenticated          | Sua sessão expirou. Entre novamente.                               |
| forbidden                | Você não tem acesso a este recurso.                               |
| not_found                | Não encontramos o que você procura.                              |
| validation               | Confira os dados informados.                                     |
| internal / unknown       | Algo deu errado. Tente novamente.                                |

> The exact key set is reconciled against the `ErrorCode` union already generated into `shared/api` during
> implementation; users never see raw codes (FR-017). No message names a payment provider or states a price.
