import { type CSSProperties, type ReactNode, useState } from "react";

import { type CatalogListState } from "@/entities/catalog/use-catalog";
import { honestWriteError } from "@/shared/api/error-messages";
import { type PremiumGate } from "@/shared/billing/premium-gate";
import { type VazioFeature, VazioDidatico } from "@/shared/billing/vazio-didatico";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { useIsListDense, useIsWide } from "@/shared/lib/use-is-wide";
import {
  Alert,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Icon,
  Sheet,
  SheetContent,
  SheetTitle,
  Spinner,
  Table,
  toast,
} from "@/shared/ui";

import "./catalog-master-detail.css";

// Generic premium catalog panel (T019, reused by T022). It owns the list/empty/loading/error/offline
// presentation plus the create/edit Sheet and the delete confirm Dialog; the entity-specific bits
// (form, row texts, wire mapping) come in as props. The honesty rules are enforced HERE: a success
// toast fires ONLY after a real 2xx; a failed write keeps the Sheet open with a specific, honest line
// (offline → "precisa de conexão"; a server code → its pt-BR phrase) and never fakes a save.
//
// 019/PR-B (T044/T045, "Premium sem parede") — não paga NÃO é mais uma parede: o corpo troca a
// crown/`ENTITLEMENT_REQUIRED` de hoje e o vazio curto pelo VAZIO DIDÁTICO (`shared/billing/
// vazio-didatico.tsx`) sempre que `gate !== "active"`, e "Adicionar" abre o MESMO formulário —
// inerte (`<Frozen>`, barreira = ausência do handler de submit; nunca um 2º gate no cliente,
// Constituição IV intocada). A faixa "Premium pausado" (T038) saiu: o rodapé do formulário inerte
// já explica.

const catalogo = messages.catalogo;
const cf = messages.catalogForm;

const captionText: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-caption)",
  color: "var(--text-muted)",
};
const rowName: CSSProperties = {
  display: "block",
  fontWeight: "var(--fw-semibold)",
  color: "var(--text-strong)",
};
const rowSummary: CSSProperties = {
  display: "block",
  fontSize: "var(--fs-caption)",
  color: "var(--text-muted)",
};

export interface CatalogPanelCopy {
  addLabel: string;
  emptyTitle: string;
  emptyBody: string;
  newTitle: string;
  editTitle: string;
  savedToast: string;
  count: (n: number) => string;
}

export interface CatalogPanelProps<TItem extends { id: string }, TForm, TWire = unknown> {
  list: CatalogListState<TItem>;
  copy: CatalogPanelCopy;
  rowName: (item: TItem) => string;
  rowSummary: (item: TItem) => string;
  /** Qual vazio didático mostrar (`shared/billing/vazio-didatico.tsx`) — um por aba. */
  feature: VazioFeature;
  /** Sheet mode (filaments/printers, §0.2). Omitted when the panel NAVIGATES instead (products). */
  emptyForm?: TForm;
  toFormValues?: (item: TItem) => TForm;
  renderForm?: (args: {
    mode: "create" | "edit";
    defaultValues: TForm;
    submitting: boolean;
    submitError?: string;
    /** 019/PR-B (T045) — os cinco estados; `renderForm` decide sozinho o que mostrar em vez do
     *  `active`/`lapsed` binário de antes (013/FB-02). */
    gate: PremiumGate;
    /** Ausente fora de `active` — a barreira é a AUSÊNCIA do handler (T045), nunca um 2º gate. */
    onSubmit?: (body: TWire) => void;
    onCancel: () => void;
  }) => ReactNode;
  create?: (body: TWire) => Promise<unknown>;
  update?: (id: string, body: TWire) => Promise<unknown>;
  /** Navigation mode (products, ux §1.6b): create/edit are FULL PAGE routes, not a Sheet. */
  onCreateNavigate?: () => void;
  onEditNavigate?: (item: TItem) => void;
  /** 019/PR-B (T107, achado do agente): AUSENTE fora de `active` — a mesma barreira estrutural de
   *  `create`/`update`. Sem `remove`, a lixeira leva à edição (o intercepto honesto do 013/FB-02),
   *  nunca a um diálogo que iria 403 no submit. */
  remove?: (id: string) => Promise<unknown>;
  /** 019/PR-B (T044) — os cinco estados que `premiumGate` deriva (`shared/billing/premium-gate`).
   *  Decide SÓ o que a tela MOSTRA (vazio didático × lista, formulário vivo × inerte); nunca o que
   *  PODE — o servidor segue sendo o gate real (Constituição IV intocada, diff vazio em
   *  `app/entitlement/`). Substitui o `lapsed?: boolean` binário do 013/FB-02. */
  gate: PremiumGate;
  /** A calm per-row note (E3/K3): the honest "needs attention" line on a product whose saved
   *  filament/printer references are missing. Absent → the row renders exactly as before. */
  rowNote?: (item: TItem) => string | undefined;
  /** Optional per-row duplicate action (E3/US4 — kits). Absent → no duplicate affordance. */
  onDuplicate?: (item: TItem) => void;
  /** A create/update is in flight (drives the form's save spinner). */
  saving?: boolean;
  /** A delete is in flight (drives the confirm-dialog spinner). */
  deleting: boolean;
  /** US6-4: an honest info line added to the delete confirm when products reference this item. */
  deleteWarning?: (item: TItem) => string | undefined;
  /** 018/US1 — rótulo do bloco de detalhe no desktop ("Filamento salvo", "Produto salvo"…). */
  detailKicker?: string;
  /** 019/PR-D (T076) — o preço recomputado HOJE (ou o preço fixado, como declaração), pronto para
   *  exibir. Ausente → a linha não mostra preço nenhum (nunca "R$ 0,00" — a ausência é honesta:
   *  item degradado, referências ainda carregando, ou a aba não tem preço nesta fatia, como Kits). */
  rowPrice?: (item: TItem) => number | undefined;
  /** O preço ANTERIOR (a última observação salva), só quando ele difere do de hoje — "era {valor}". */
  rowWas?: (item: TItem) => number | undefined;
  /** A marca da linha ("fixado"/"parado") — o `tf-plist__flag` da prancheta 16f/17c·2. */
  rowFlag?: (item: TItem) => { kind: "fixed" | "stopped"; label: string } | undefined;
  /** Uma legenda curta por linha ("Salvo em {data}"/"Parou em {data}") — soma-se a `rowSummary`,
   *  nunca a substitui (FR-310 continua valendo: a referência do produto é o texto principal). */
  rowMeta?: (item: TItem) => string | undefined;
}

type SheetState<TItem> = { mode: "create" } | { mode: "edit"; item: TItem };

export function CatalogPanel<TItem extends { id: string }, TForm, TWire = unknown>({
  list,
  copy,
  rowName: nameOf,
  rowSummary: summaryOf,
  rowNote: noteOf,
  feature,
  gate,
  onDuplicate,
  emptyForm,
  toFormValues,
  renderForm,
  create,
  update,
  onCreateNavigate,
  onEditNavigate,
  remove,
  saving,
  deleting,
  deleteWarning,
  detailKicker,
  rowPrice,
  rowWas,
  rowFlag,
  rowMeta,
}: CatalogPanelProps<TItem, TForm, TWire>) {
  const [sheet, setSheet] = useState<SheetState<TItem> | null>(null);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<TItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>(undefined);

  // 018/US1 — mestre-detalhe do desktop. Estado local, NUNCA na URL: a aba continua vindo de
  // `?tab=` (013/F-02 segue valendo), mas a seleção dentro de uma lista é efêmera e escrevê-la na
  // URL faria cada clique mexer no roteador sem que ninguém queira aquele link (ADR-0031/C).
  const isWide = useIsWide();
  // 019/PR-D (T076/T130) — a faixa 1024–1279px vira `tf-table` densa; ≥1280 o mestre-detalhe do
  // 018 assume. `useIsListDense()` sozinho responde "true" em AMBAS as faixas (1024px é o piso das
  // duas), então a tabela só entra quando o mestre-detalhe NÃO entrou.
  const isDense = useIsListDense() && !isWide;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A seleção "vaza" de seção sozinha? Não: a página monta um componente DIFERENTE por seção, então
  // trocar de aba desmonta este painel e o estado nasce limpo.
  const [inlineError, setInlineError] = useState<string | undefined>(undefined);

  const openCreate = () => {
    if (onCreateNavigate) return onCreateNavigate(); // full-page route (products, §1.6b)
    setSubmitError(undefined);
    setSheet({ mode: "create" });
  };
  const openEdit = (item: TItem) => {
    if (onEditNavigate) return onEditNavigate(item);
    setSubmitError(undefined);
    setSheet({ mode: "edit", item });
  };
  const closeSheet = () => {
    setSheet(null);
    setSubmitError(undefined);
  };

  // 019/PR-B (T106, achado 01 da auditoria) — o toast FALSO: `await create?.(body)` com `create`
  // ausente resolvia pra `undefined` sem lançar, e caía direto no toast + fechar como se um 2xx
  // real tivesse acontecido. A barreira agora é uma saída explícita: sem `writer`, nem toast nem
  // fechamento — os valores digitados continuam na tela (nunca um sucesso inventado).
  const handleSubmit = async (body: TWire) => {
    setSubmitError(undefined);
    if (sheet?.mode === "edit") {
      if (!update) return;
      try {
        await update(sheet.item.id, body);
        toast(copy.savedToast, { tone: "success" }); // real 2xx only
        setSheet(null);
      } catch (err) {
        setSubmitError(honestWriteError(err));
      }
      return;
    }
    if (!create) return;
    try {
      await create(body);
      toast(copy.savedToast, { tone: "success" }); // real 2xx only
      setSheet(null);
    } catch (err) {
      setSubmitError(honestWriteError(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !remove) return;
    setDeleteError(undefined);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(honestWriteError(err));
    }
  };

  // 018/US1 — salvar PELA FICHA: mesma mutation do Sheet, mesmo toast só depois de um 2xx real, e o
  // erro fica ao lado do formulário em vez de dentro de uma gaveta que nem está aberta.
  const handleInlineSubmit = async (item: TItem, wire: TWire) => {
    setInlineError(undefined);
    if (!update) return; // T106 — mesma barreira: sem `update`, nem toast nem sucesso inventado
    try {
      await update(item.id, wire);
      toast(copy.savedToast, { tone: "success" });
    } catch (err) {
      setInlineError(honestWriteError(err));
    }
  };

  const addButton = (block = false) => (
    <Button size="sm" onClick={openCreate} className={block ? undefined : "shrink-0"}>
      <Icon name="plus" size={16} aria-hidden /> {copy.addLabel}
    </Button>
  );

  const rowActions = (item: TItem) => (
    <>
      {onDuplicate && (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${catalogo.duplicate} ${nameOf(item)}`}
          onClick={() => onDuplicate(item)}
        >
          <Icon name="copy" size={18} aria-hidden />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${catalogo.remove} ${nameOf(item)}`}
        onClick={() => (remove ? setDeleteTarget(item) : openEdit(item))}
      >
        <Icon name="trash-2" size={18} aria-hidden />
      </Button>
    </>
  );

  // 019/PR-D (T076, prancheta 16b/16f/16g) — a coluna de valor: preço + "era" + a marca da linha.
  // Ausente quando `rowPrice` não devolve nada (item degradado, sem recompute nesta fatia — Kits —
  // ou referências ainda carregando): NUNCA "R$ 0,00" no lugar de um preço que não existe.
  const priceVal = (item: TItem): ReactNode => {
    const price = rowPrice?.(item);
    if (price === undefined) return null;
    const was = rowWas?.(item);
    const flag = rowFlag?.(item);
    return (
      <span className="tf-plist__val">
        <span className="tf-plist__price">{formatBRL(price)}</span>
        {was !== undefined && (
          <span className="tf-plist__was" data-testid="product-row-was">
            {catalogo.priceWasLabel.replace("{valor}", formatBRL(was))}
          </span>
        )}
        {flag && (
          <span
            className="tf-plist__flag"
            data-testid={flag.kind === "fixed" ? "product-row-fixed" : undefined}
          >
            {/* O desenho (17c·2) usa `tf-ico-lock` para "fixado" — glifo ausente do conjunto
                curado (`shared/ui/icon.tsx`); registrado no relatório da fatia, sem inventar um
                substituto. "parado" usa `triangle-alert`, que já existe. */}
            {flag.kind === "stopped" && <Icon name="triangle-alert" size={14} aria-hidden />}
            {flag.label}
          </span>
        )}
      </span>
    );
  };

  // 019/PR-B (T044) — "Adicionar" no vazio didático abre o MESMO formulário de sempre, inerte fora
  // de `active`; o Sheet mobile e a ficha do mestre-detalhe são o MESMO propósito (nunca dois
  // convites simultâneos — FR-1906), então o teaser do vazio se apaga enquanto um dos dois está
  // aberto (`teaser={sheet === null}`).
  const nonActiveGate: Exclude<PremiumGate, "active"> | null = gate !== "active" ? gate : null;

  let body: ReactNode;
  if (list.isLoading) {
    body = (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  } else if (
    nonActiveGate &&
    ((list.isError && list.error?.code === "ENTITLEMENT_REQUIRED") ||
      // Um `lapsed` com cache vazio e a REDE falhando não é "nenhum item cadastrado": ele tem itens
      // que a leitura não trouxe — cai no erro de carga (a ordem da prancheta 29: erro antes de vazio).
      (list.items.length === 0 && !(list.isError && gate === "lapsed")))
  ) {
    // Não paga (ou deslogado, ou pausou): a lista está vazia porque nunca houve leitura (403
    // honesto) ou porque de fato não há nada salvo — os dois casos leem IGUAL (prancheta 32a/32c):
    // o vazio didático, nunca a parede/crown de antes.
    if (isWide && renderForm && toFormValues) {
      // 32g — mestre-detalhe: o vazio à esquerda, o formulário INERTE de criação à direita. O
      // convite mora SEMPRE num rodapé de formulário aqui (a ficha, ou o Sheet quando aberto) —
      // o vazio nunca carrega o seu, senão o desktop mostra dois (FR-1906; T041 conta a 1920).
      body = (
        <div className="tf-catalog-md">
          <div className="tf-catalog-md__master">
            <VazioDidatico
              feature={feature}
              gate={nonActiveGate}
              action={addButton(true)}
              teaser={false}
            />
          </div>
          {sheet === null && (
            <aside className="tf-card tf-catalog-md__detail" data-testid="detail-panel">
              {renderForm({
                mode: "create",
                defaultValues: emptyForm as TForm,
                submitting: saving ?? false,
                submitError: undefined,
                gate,
                onSubmit: undefined,
                onCancel: () => undefined,
              })}
            </aside>
          )}
        </div>
      );
    } else {
      // Produtos/kits (navegam, sem `renderForm`) ou mobile: só o vazio, com o único convite.
      body = (
        <VazioDidatico
          feature={feature}
          gate={nonActiveGate}
          action={addButton(true)}
          teaser={sheet === null}
        />
      );
    }
  } else if (list.isError) {
    body = (
      <Alert tone="danger" title={catalogo.loadError}>
        <Button variant="secondary" size="sm" onClick={list.refetch} className="mt-2">
          {catalogo.retry}
        </Button>
      </Alert>
    );
  } else if (list.items.length === 0) {
    // `active` e vazio de verdade: o vazio CURTO de sempre, sem convite nenhum.
    body = (
      <EmptyState
        icon="package"
        title={copy.emptyTitle}
        description={copy.emptyBody}
        action={addButton(true)}
      />
    );
  } else if (isWide) {
    // ---- 018/US1 — mestre-detalhe (≥1280px). Lista à esquerda, ficha do item à direita. ----
    const term = query.trim().toLowerCase();
    const visible = term
      ? list.items.filter((item) =>
          `${nameOf(item)} ${summaryOf(item)}`.toLowerCase().includes(term),
        )
      : list.items;
    // Derivada contra a lista ATUAL a cada render: item excluído, filtrado ou vindo de outro
    // aparelho cai para um item válido — nunca para uma ficha órfã.
    const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

    body = (
      <div className="tf-catalog-md">
        <div className="tf-catalog-md__master">
          <div className="tf-catalog-md__toolbar">
            <label className="tf-inputwrap tf-catalog-md__search">
              <span className="sr-only">{catalogo.searchLabel}</span>
              <Icon name="search" size={18} aria-hidden />
              <input
                className="tf-input"
                type="search"
                value={query}
                placeholder={catalogo.searchPlaceholder}
                aria-label={catalogo.searchLabel}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <p style={captionText}>{copy.count(visible.length)}</p>
            {addButton()}
          </div>

          {visible.length === 0 ? (
            // O vazio da BUSCA não é o vazio do catálogo: aqui existem itens salvos, o filtro é que
            // não achou. Dizer "nenhum filamento salvo" seria mentira sobre os dados do vendedor.
            <EmptyState
              icon="package"
              title={catalogo.searchEmptyTitle}
              description={catalogo.searchEmptyBody}
              action={
                <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                  {catalogo.searchClear}
                </Button>
              }
            />
          ) : (
            <ul className="tf-catalog-md__list" data-testid="master-list">
              {visible.map((item) => {
                const isSelected = selected?.id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid="master-item"
                      aria-current={isSelected ? "true" : undefined}
                      className={`tf-card tf-card--interactive tf-catalog-md__card${
                        isSelected ? " tf-catalog-md__card--selected" : ""
                      }`}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {/* 019/PR-D (T076) — o conteúdo vira uma linha `tf-plist` (nome+meta à
                          esquerda, preço+era+flag à direita) SEM trocar o `<button>` de fora: os
                          testids/`aria-current` do mestre-detalhe (018/US1) continuam iguais. */}
                      <span className="flex w-full items-start justify-between gap-3">
                        <span className="tf-plist__main">
                          <span style={rowName}>{nameOf(item)}</span>
                          <span style={rowSummary}>{summaryOf(item)}</span>
                          {rowMeta?.(item) && <span style={rowSummary}>{rowMeta(item)}</span>}
                          {noteOf?.(item) && (
                            <span style={rowSummary} data-testid="row-note">
                              {noteOf(item)}
                            </span>
                          )}
                          {list.stale && <span style={rowSummary}>{catalogo.staleHint}</span>}
                          {gate === "lapsed" && (
                            <span style={rowSummary}>{catalogo.readOnlyHint}</span>
                          )}
                        </span>
                        {priceVal(item)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected && (
          <aside className="tf-card tf-catalog-md__detail" data-testid="detail-panel">
            <header className="tf-catalog-md__detail-head">
              <div className="tf-catalog-md__detail-title">
                {detailKicker && <span className="tf-catalog-md__kicker">{detailKicker}</span>}
                <h2>{nameOf(selected)}</h2>
              </div>
              <div className="flex items-center gap-1">{rowActions(selected)}</div>
            </header>

            {noteOf?.(selected) && <Alert tone="info">{noteOf(selected)}</Alert>}
            {inlineError && <Alert tone="danger">{inlineError}</Alert>}

            {renderForm && toFormValues ? (
              // Filamento e impressora: a ficha É o editor. O MESMO formulário do Sheet, montado
              // aqui — não uma segunda cópia (decisão do dono no clarify; research §E).
              // `key` pelo id: sem ele o RHF manteria os defaultValues do item anterior, porque
              // `defaultValues` só valem na montagem.
              <div key={selected.id}>
                {renderForm({
                  mode: "edit",
                  defaultValues: toFormValues(selected),
                  submitting: saving ?? false,
                  submitError: inlineError,
                  gate,
                  onSubmit:
                    gate === "active"
                      ? (wire) => void handleInlineSubmit(selected, wire)
                      : undefined,
                  onCancel: () => setInlineError(undefined),
                })}
              </div>
            ) : (
              // Produto e kit: a ficha RESUME e manda para o editor de página cheia que já existe.
              <div className="flex flex-col gap-3">
                <p style={rowSummary}>{summaryOf(selected)}</p>
                <Button variant="secondary" onClick={() => openEdit(selected)}>
                  <Icon name="pencil" size={18} aria-hidden /> {catalogo.detailOpenEditor}
                </Button>
              </div>
            )}
          </aside>
        )}
      </div>
    );
  } else if (isDense) {
    // 019/PR-D (T076/T130, prancheta 16g) — 1024–1279px: `tf-table`, a coluna "Antes" é o "era R$
    // X" da lista promovida a coluna, e um travessão (`tableNoChange`) onde a linha não mudou.
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p style={captionText}>{copy.count(list.items.length)}</p>
          {addButton()}
        </div>
        <Table>
          <thead>
            <tr>
              <th scope="col">{catalogo.tableColName}</th>
              <th scope="col" style={{ textAlign: "right" }}>
                {catalogo.tableColPrice}
              </th>
              <th scope="col" style={{ textAlign: "right" }}>
                {catalogo.tableColBefore}
              </th>
              <th scope="col">{catalogo.tableColSavedAt}</th>
              <th scope="col">
                <span className="sr-only">{catalogo.tableColActions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((item) => {
              const price = rowPrice?.(item);
              const was = rowWas?.(item);
              return (
                <tr key={item.id}>
                  <td className="tf-table__name">
                    <button type="button" onClick={() => openEdit(item)} className="tf-table__name">
                      {nameOf(item)}
                    </button>
                  </td>
                  <td className="tf-table__num">{price !== undefined ? formatBRL(price) : "—"}</td>
                  <td className="tf-table__num tf-table__num--muted">
                    {was !== undefined ? formatBRL(was) : catalogo.tableNoChange}
                  </td>
                  <td>{rowMeta?.(item) ?? summaryOf(item)}</td>
                  <td className="tf-table__actions">{rowActions(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p style={captionText}>{copy.count(list.items.length)}</p>
          {addButton()}
        </div>
        <ul className="flex flex-col gap-2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.items.map((item) => (
            <li key={item.id}>
              <Card padding="sm" className="flex items-center gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEdit(item)}
                >
                  {/* 019/PR-D (T076) — mesma linha `tf-plist` (nome+meta à esquerda, preço+era+flag
                      à direita) usada no mestre-detalhe; o `<button>` de fora continua o mesmo
                      alvo de toque de sempre (nenhum teste de `openEdit` muda). */}
                  <span className="flex w-full items-start justify-between gap-3">
                    <span className="tf-plist__main">
                      <span style={rowName}>{nameOf(item)}</span>
                      <span style={rowSummary}>{summaryOf(item)}</span>
                      {rowMeta?.(item) && <span style={rowSummary}>{rowMeta(item)}</span>}
                      {noteOf?.(item) && (
                        <span style={rowSummary} data-testid="row-note">
                          {noteOf(item)}
                        </span>
                      )}
                      {list.stale && <span style={rowSummary}>{catalogo.staleHint}</span>}
                      {gate === "lapsed" && <span style={rowSummary}>{catalogo.readOnlyHint}</span>}
                    </span>
                    {priceVal(item)}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.edit} ${nameOf(item)}`}
                  onClick={() => openEdit(item)}
                >
                  <Icon name="pencil" size={18} aria-hidden />
                </Button>
                {onDuplicate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${catalogo.duplicate} ${nameOf(item)}`}
                    onClick={() => onDuplicate(item)}
                  >
                    <Icon name="copy" size={18} aria-hidden />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${catalogo.remove} ${nameOf(item)}`}
                  // 013/FB-02 (T034 homologation nit): on lapsed, tapping delete must NOT open the
                  // working destructive confirm and then 403 on submit — ux-catalog §3: "Never show a
                  // delete/edit as *working* then fail — the intercept happens on tap, honestly." Edit
                  // already routes lapsed to the read-only reactivation surface; delete now mirrors it,
                  // so both write affordances land on the same honest intercept (the server's
                  // ENTITLEMENT_REQUIRED 403 stays the real backstop — this is presentation only).
                  onClick={() => (remove ? setDeleteTarget(item) : openEdit(item))}
                >
                  <Icon name="trash-2" size={18} aria-hidden />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Offline read (Q2): calm info banner, never danger. Writes still surface an honest intercept. */}
      {list.stale && (
        <Alert tone="info" title={catalogo.offlineTitle}>
          {catalogo.offlineBody}
        </Alert>
      )}

      {body}

      {/* Create / edit — right-anchored full-height Sheet (survives the mobile keyboard, §0.2). */}
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) closeSheet();
        }}
      >
        <SheetContent side="right">
          {sheet && renderForm && (
            <div className="flex flex-col gap-4">
              <SheetTitle>{sheet.mode === "edit" ? copy.editTitle : copy.newTitle}</SheetTitle>
              {renderForm({
                mode: sheet.mode,
                defaultValues:
                  sheet.mode === "edit" ? toFormValues!(sheet.item) : (emptyForm as TForm),
                submitting: saving ?? false,
                submitError,
                gate,
                // T045 — a barreira é a AUSÊNCIA do handler: fora de `active` o formulário nem
                // recebe onSubmit (o `<form>` do FilamentForm/PrinterForm não fica com um handler
                // ligado a um botão desabilitado; `handleSubmit` acima é a segunda camada, para
                // quem chamar `renderForm` diretamente com `gate="active"` mas sem essa checagem).
                onSubmit: gate === "active" ? handleSubmit : undefined,
                onCancel: closeSheet,
              })}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete — center confirm Dialog with the name echoed; never a silent delete. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(undefined);
          }
        }}
      >
        <DialogContent variant="center">
          {deleteTarget && (
            <div className="flex flex-col gap-3">
              <DialogTitle>{cf.deleteTitle.replace("{nome}", nameOf(deleteTarget))}</DialogTitle>
              <DialogDescription>{cf.deleteBody}</DialogDescription>
              {/* US6-4: referenced-item warn — honest heads-up, still deletable (server captures
                  last-known + unlinks in the same txn). */}
              {deleteWarning?.(deleteTarget) && (
                <Alert tone="info">{deleteWarning(deleteTarget)}</Alert>
              )}
              {deleteError && <Alert tone="danger">{deleteError}</Alert>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                  {cf.cancel}
                </Button>
                <Button variant="danger" loading={deleting} onClick={handleDelete}>
                  {cf.deleteConfirm}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
