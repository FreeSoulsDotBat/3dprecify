#!/bin/sh
# 015/A4 ([F09-001]) — toda `uses:` de workflow tem de apontar para um SHA de 40 caracteres.
#
# Por que isto existe, e por que ele roda no CI e nao so na cabeca de quem revisa: a auditoria
# pre-provisionamento mediu **0 de 33** usos fixados, incluindo `trufflesecurity/trufflehog@main`
# — uma action de terceiro por BRANCH mutavel. E o achado nao era novo: o parecer de seguranca
# `SEC-014-02` ja o classificara como ALTA, marcara `[VERIFICADO]`, e escrevera a remediacao com a
# palavra "imediatamente". Ficou tres meses sem ser feito.
#
# A licao nao e "alguem esqueceu" — e que uma remediacao que depende de lembranca nao acontece.
# Sem este guarda, o proximo PR que acrescentar `uses: alguma/action@v1` desfaz o conserto em
# silencio, e ninguem descobre ate o dia em que a tag for repontada.
#
# Uma tag e um PONTEIRO MUTAVEL: quem controla o repositorio da action (ou quem o comprometa) pode
# repontar `@v2` para codigo arbitrario, que passa a rodar DENTRO do job — no caso do `deploy.yml`,
# com `id-token: write` e as credenciais WIF de producao. Um SHA e imutavel.
set -eu

falhas=0
for arquivo in .github/workflows/*.yml; do
    [ -e "$arquivo" ] || continue
    # `uses: ./algo` e `uses: docker://` nao sao actions de repositorio e nao tem SHA a fixar.
    linhas=$(grep -nE "^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]" "$arquivo" \
        | grep -vE "uses:[[:space:]]+\./" \
        | grep -vE "uses:[[:space:]]+docker://" \
        | grep -vE "uses:[[:space:]]+[^[:space:]]+@[0-9a-f]{40}([[:space:]]|$)" || true)
    if [ -n "$linhas" ]; then
        echo "$arquivo:"
        echo "$linhas" | sed 's/^/    /'
        falhas=$((falhas + 1))
    fi
done

if [ "$falhas" -ne 0 ]; then
    cat <<'FIM'

Toda action tem de ser fixada por SHA de 40 caracteres (015/A4, SEC-014-02).

Como resolver, para uma tag `vN`:

    gh api repos/<dono>/<repo>/git/ref/tags/vN --jq '.object.sha'
    # se `.object.type` for "tag" (tag anotada), resolva mais um nivel:
    gh api repos/<dono>/<repo>/git/tags/<sha-acima> --jq '.object.sha'

e escreva `uses: dono/repo@<sha40> # vN` — o comentario preserva a legibilidade que o SHA tira.
FIM
    exit 1
fi

# `awk` e nao `bc`: este script roda em Git Bash no Windows, onde `bc` nao existe — e um
# guarda que quebra no caminho de SUCESSO nao guarda nada.
total=$(grep -rhE "uses:[[:space:]]" .github/workflows/*.yml | wc -l | tr -d " ")
echo "ok — todas as ${total} referencias estao fixadas por SHA"

# 015/A4, e este bloco existe porque um YAML quebrado passou por mim: escrevi
# `name: Action pinning guard (uses: @sha40)` e o `: ` sem aspas fez o valor virar um MAPA. O
# `prettier --check` aprovou o arquivo — ele formata YAML, nao o valida. Nada mais no gate lia
# estes arquivos, entao a quebra so apareceria no GitHub, depois do push, como um workflow que
# nao existe. Um guarda que le os workflows e o lugar certo para tambem provar que eles PARSEIAM.
py=""
for candidato in python3 python; do
    if command -v "$candidato" >/dev/null 2>&1; then py="$candidato"; break; fi
done
if [ -z "$py" ]; then
    echo "AVISO: sem python no PATH — a validacao de sintaxe YAML NAO rodou." >&2
    exit 0
fi
"$py" - <<'PYEOF' || exit 1
import glob, sys
try:
    import yaml
except ImportError:
    print("AVISO: PyYAML ausente - validacao de sintaxe YAML NAO rodou.", file=sys.stderr)
    sys.exit(0)
falhou = False
arquivos = sorted(glob.glob(".github/workflows/*.yml"))
for f in arquivos:
    try:
        d = yaml.safe_load(open(f, encoding="utf-8"))
    except yaml.YAMLError as exc:
        print(f"{f}: YAML invalido -> {exc}", file=sys.stderr)
        falhou = True
        continue
    if not isinstance(d, dict) or not d.get("jobs"):
        print(f"{f}: parseia, mas nao declara `jobs` - workflow vazio?", file=sys.stderr)
        falhou = True
if not falhou:
    # 017/T002 (J.6) — a contagem e CALCULADA, e o print sai de dentro do proprio laco que validou.
    #
    # Ela era a literal "os 5 workflows parseiam". Com a PR-A o repositorio passa de 5 para 3
    # (as sondas descartaveis morrem, decisao H) e com a T015 volta para 4 — a linha diria "5" nos
    # tres estados. E a mesma classe de defeito que o proprio guarda existe para pegar: uma
    # AFIRMACAO QUE NAO ACOMPANHA O SISTEMA. Aqui o dano e so cosmetico; a licao de 014/US4 e que
    # ninguem descobre pela prosa qual das duas afirmacoes do relatorio e a que envelheceu.
    plural = "workflow parseia" if len(arquivos) == 1 else "workflows parseiam"
    print(f"ok - os {len(arquivos)} {plural} e declaram jobs")
sys.exit(1 if falhou else 0)
PYEOF
