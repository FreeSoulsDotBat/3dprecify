# Runbook — pedido de exclusão de conta (LGPD art. 18, VI)

**Quem executa**: o operador (hoje, o dono). **Não existe rota HTTP para isto**, de propósito: "só
operador" vale por ausência de caminho, não por uma verificação que alguém pode esquecer.

**Prazo legal**: a LGPD não fixa um prazo geral para a eliminação; a ANPD orienta atender no menor
prazo possível, e 15 dias é a referência prática usada para pedidos de acesso (art. 19, II).
Trate **15 dias corridos** como o alvo interno.

---

## O que este procedimento faz, em uma frase

**Apaga quem, mantém quanto.** O titular sai — e-mail, uid e todo o conteúdo dele — e o registro de
que uma venda existiu permanece, sem dono identificável.

Isso não é um meio-termo de conveniência: são duas obrigações reais que não se contradizem, porque
o que identifica a pessoa não é o mesmo dado que registra o dinheiro.

| obrigação | o que ela exige | como é atendida |
| --- | --- | --- |
| LGPD art. 18, VI | eliminação dos dados pessoais | e-mail apagado, uid trocado por pseudônimo aleatório de uso único, conteúdo do titular apagado |
| Lei 8.212/91 art. 32 | retenção fiscal por **5 anos** | valor, data e versão da fórmula do snapshot permanecem intactos |

---

## Passo a passo

### 1. Registre o pedido

Guarde a data, o canal e a identificação do titular **fora do banco de produção** (o pedido em si é
prova de que você atendeu; ele não pode viver dentro do que vai ser anonimizado).

### 2. Confirme que quem pede é o titular

Não há passo automatizado para isto. Confirme pelo canal de origem — responder ao **e-mail
cadastrado** é o mínimo. Anonimizar a conta errada é irreversível.

### 3. Veja o que vai acontecer, sem escrever nada

```bash
cd backend
uv run python -m app.scripts.erase_account preview <uid-ou-email>
```

A saída separa o que será apagado do que será mantido, com contagens. **Leia antes de seguir.** Se
os números não fizerem sentido (uma conta com zero de tudo, ou uma com muito mais do que o esperado),
pare e investigue — é mais barato que desfazer, porque desfazer não existe.

### 4. Execute

```bash
uv run python -m app.scripts.erase_account erase <uid-ou-email> --confirm <uid-ou-email>
```

O `--confirm` precisa repetir o alvo exatamente. Tudo roda numa transação: ou a conta inteira é
anonimizada, ou nada muda.

### 5. Responda ao titular

Diga o que foi feito **e o que permanece**, sem eufemismo. Sugestão de texto:

> Sua conta foi eliminada. Seu e-mail e todo o conteúdo que você cadastrou (produtos, filamentos,
> impressoras, kits e cenários) foram apagados. Os registros de cobrança e os orçamentos que você
> congelou permanecem sem qualquer vínculo com você, por obrigação fiscal de retenção de 5 anos —
> não é possível identificá-lo a partir deles.

### 6. Arquive a evidência

Guarde a saída do comando (ela imprime o plano aplicado e o pseudônimo gerado) junto ao registro do
passo 1.

---

## O que fica, e por quê

| tabela | destino |
| --- | --- |
| `accounts` | **apagada**; uma linha-pseudônimo sem e-mail é criada no lugar |
| `filaments`, `printers`, `products`, `boms`, `bom_lines`, `scenarios` | **apagados** |
| `snapshots` | **anonimizados**: repontados ao pseudônimo, `label` removido, `payload` reduzido aos números, `anonymized_at` carimbado |
| `entitlement_grants`, `subscriptions`, `billing_events` | **mantidos**, repontados ao pseudônimo |

O pseudônimo é aleatório (`anon-` + 32 hex) e **a correspondência com o titular não é guardada em
lugar nenhum**. Sem tabela de volta não há reidentificação — é anonimização, não pseudonimização
reversível.

---

## Garantias que o banco impõe, não a aplicação

Estas não dependem de o operador lembrar (migração `0006`, gatilho `snapshots_forbid_content_update`):

1. **A anonimização é de mão única.** `anonymized_at` não volta a `NULL` nem se move. Quem tiver
   acesso ao banco não consegue "desanonimizar".
2. **Os fatos contábeis não cedem nem durante a anonimização.** `headline_total`, `device_quoted_at`,
   `model_version`, `kind`, `created_at` e `id` são recusados pelo gatilho **mesmo** no comando de
   exclusão. A frase "mantemos o registro contábil" é imposta, não prometida.
3. **Snapshot não é apagado por SQL comum.** Existe um gatilho `BEFORE DELETE` que recusa. O caminho
   auditável é o único disponível.

---

## Limites conhecidos — leia antes de prometer algo ao titular

1. **A conta do Firebase Auth não é tocada por este comando.** Ele age no banco da aplicação. A
   exclusão do usuário no Firebase é um passo **manual e separado**, no console. Sem ele, o titular
   ainda consegue autenticar — e, ao entrar, o `ensure_account` provisiona uma conta nova e vazia
   (isso não recupera nada, mas é confuso para quem pediu para sair).
2. **Backups.** Uma restauração de backup anterior à exclusão traria os dados de volta. Quando houver
   política de backup definida (não há hoje — nada foi provisionado), ela precisa dizer como pedidos
   de exclusão são reaplicados após uma restauração.
3. **Assinatura ativa.** Este comando **não cancela** a assinatura no Mercado Pago. Cancele primeiro
   (`/conta` ou o painel do MP); anonimizar antes deixaria uma cobrança recorrente sem dono visível.
4. **Não há autoexclusão pelo app.** Foi decisão do dono em 2026-08-03: CLI de operador + este
   procedimento. Uma rota autenticada de autoexclusão fica para quando o volume justificar.

---

*Criado em 2026-08-03 (015/A9), a partir do achado `[F05-001]` da homologação pré-provisionamento.
Antes disto não havia rota, nem CLI, nem procedimento — e o produto já ia cobrar de brasileiros.*
