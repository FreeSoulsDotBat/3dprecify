import { captionText, gridCard, sectionLabel } from "@/features/calculator/calculator-form";
import { messages } from "@/shared/i18n/messages.pt-br";
import { NAME_MAX } from "@/shared/lib/name-norm";
import { Card, Field, Select, TextField } from "@/shared/ui";

import { EditableSection } from "./produto-page-editable-section";

// 019/Polish — moved verbatim out of produto-page.tsx: the name Card + the catalog-refs Card
// (identidade), both wrapped in the SAME `EditableSection` as before. No state/effect moved —
// `name`/`nameError`/`filamentId`/`printerId` stay owned by the page, threaded down as props.

const t = messages.calculator;
const pf = messages.productForm;
const cf = messages.catalogForm;

export function ProductIdentitySection({
    active,
    name,
    onNameChange,
    nameError,
    filamentId,
    onFilamentChange,
    printerId,
    onPrinterChange,
    filamentOptions,
    printerOptions,
}: {
    active: boolean;
    name: string;
    onNameChange: (value: string) => void;
    nameError: string | undefined;
    filamentId: string;
    onFilamentChange: (id: string) => void;
    printerId: string;
    onPrinterChange: (id: string) => void;
    filamentOptions: { value: string; label: string }[];
    printerOptions: { value: string; label: string }[];
}) {
    return (
        <EditableSection active={active}>
            <Card padding="md" className="flex flex-col gap-3">
                <Field
                    label={pf.nameLabel}
                    required
                    error={nameError}
                    hint={cf.nameCounter
                        .replace("{n}", String(name.length))
                        .replace("{max}", String(NAME_MAX))}
                >
                    {(p) => (
                        <TextField
                            {...p}
                            type="text"
                            placeholder={pf.namePlaceholder}
                            value={name}
                            maxLength={NAME_MAX}
                            onChange={(e) => onNameChange(e.target.value)}
                        />
                    )}
                </Field>
                {/* 17b·2 — a dica some quando o erro NÃO é "nome repetido" (o `Field` compartilhado
              só mostra hint OU erro; a dica de apoio do conflito é uma segunda linha própria,
              simultânea ao erro, como o desenho pede). */}
                {nameError === cf.nameConflict && <p style={captionText}>{cf.nameConflictHint}</p>}
            </Card>

            {/* The catalog refs — same picker as Calcular; picking pre-fills the editable fields. */}
            <Card padding="md" className="flex flex-col gap-3">
                <p style={sectionLabel}>{t.catalogPicker.title}</p>
                <p style={captionText}>{t.catalogPicker.hint}</p>
                <div style={gridCard}>
                    <Field label={t.catalogPicker.filament} tightLabel>
                        {(p) => (
                            <Select
                                {...p}
                                options={filamentOptions}
                                value={filamentId}
                                onChange={(e) => onFilamentChange(e.target.value)}
                            />
                        )}
                    </Field>
                    <Field label={t.catalogPicker.printer} tightLabel>
                        {(p) => (
                            <Select
                                {...p}
                                options={printerOptions}
                                value={printerId}
                                onChange={(e) => onPrinterChange(e.target.value)}
                            />
                        )}
                    </Field>
                </div>
            </Card>
        </EditableSection>
    );
}
