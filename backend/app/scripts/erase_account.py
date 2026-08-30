"""015/A9 ([F05-001]) — CLI de operador para atender um pedido de eliminação da LGPD (art. 18, VI).

NÃO existe rota HTTP para isto, pela mesma razão do ``grant_premium``: "só operador" vale por
AUSÊNCIA de caminho, não por uma verificação que alguém pode esquecer.

O que a lei pede é que o titular consiga sair. O que a contabilidade pede é que a venda não
desapareça. As duas coisas cabem juntas porque **o que identifica o titular não é o mesmo que o que
registra o dinheiro** — então o comando ANONIMIZA em vez de apagar:

* ``accounts``   — e-mail apagado, uid substituído por um pseudônimo aleatório de uso único
* ``snapshots``  — repontados ao pseudônimo, ``payload`` reduzido aos números, ``anonymized_at``
                   carimbado (migração 0006 — o gatilho só permite esta transição, e só uma vez)
* o restante     — produtos, filamentos, impressoras, kits e cenários são do titular e vão embora

O pseudônimo é aleatório e a correspondência **não é guardada em lugar nenhum**: sem tabela de
volta, não há reidentificação — é anonimização, não pseudonimização reversível.

O que NÃO some, de propósito, e o operador precisa saber disto ao responder o titular:
  * ``entitlement_grants`` e ``billing_events`` seguem o pseudônimo — são o registro de que um
    pagamento existiu, e a obrigação fiscal de retenção é de 5 anos (Lei 8.212/91, art. 32);
  * ``headline_total``, datas e ``model_version`` dos snapshots continuam intactos — o gatilho
    recusa alterá-los MESMO durante a anonimização.

Uso (a partir de ``backend/``)::

    uv run python -m app.scripts.erase_account preview <uid-ou-email>
    uv run python -m app.scripts.erase_account erase  <uid-ou-email> --confirm <uid-ou-email>

O ``preview`` não escreve nada e é o primeiro passo do procedimento
(``docs/runbooks/lgpd-exclusao-de-conta.md``). O ``erase`` exige que ``--confirm`` repita o alvo:
é irreversível por construção, então digitar duas vezes é barato perto do erro.
"""

from __future__ import annotations

import argparse
import secrets
import sys
from dataclasses import dataclass
from datetime import UTC, datetime

import sqlalchemy as sa

from app.settings import get_settings


class EraseError(Exception):
    """Falha voltada ao operador (conta desconhecida, confirmação que não bate)."""


#: As tabelas cujo conteúdo é do titular e vai embora — na ordem em que as FKs permitem apagar.
#: `bom_lines` cai por CASCADE a partir de `boms`; `products` referencia filamento/impressora com
#: `ON DELETE SET NULL`, então a ordem entre eles não importa, mas manter explícito documenta.
OWNED_TABLES = ("scenarios", "boms", "products", "printers", "filaments")

#: As que PERMANECEM, repontadas ao pseudônimo. Estão aqui para serem lidas, não configuradas.
RETAINED_TABLES = ("snapshots", "entitlement_grants", "billing_events", "subscriptions")


@dataclass(frozen=True)
class Plan:
    account_uid: str
    email: str | None
    owned: dict[str, int]
    retained: dict[str, int]


def _resolve(conn: sa.Connection, alvo: str) -> tuple[str, str | None]:
    row = conn.execute(
        sa.text(
            "SELECT account_uid, email FROM accounts "
            "WHERE account_uid = :t OR lower(email) = lower(:t)"
        ),
        {"t": alvo},
    ).first()
    if row is None:
        raise EraseError(f"conta nao encontrada: {alvo!r}")
    return str(row[0]), (str(row[1]) if row[1] is not None else None)


def _count(conn: sa.Connection, tabela: str, uid: str, coluna: str) -> int:
    return int(
        conn.execute(
            sa.text(f"SELECT count(*) FROM {tabela} WHERE {coluna} = :u"),  # noqa: S608
            {"u": uid},
        ).scalar_one()
    )


def _owner_column(tabela: str) -> str:
    """`entitlement_grants` usa `account_uid`; todo o resto usa `owner_uid`."""
    return "account_uid" if tabela == "entitlement_grants" else "owner_uid"


def build_plan(conn: sa.Connection, alvo: str) -> Plan:
    uid, email = _resolve(conn, alvo)
    owned = {t: _count(conn, t, uid, "owner_uid") for t in OWNED_TABLES}
    retained = {
        t: _count(conn, t, uid, _owner_column(t)) for t in RETAINED_TABLES if t != "billing_events"
    }
    # `billing_events` liga-se pela assinatura, não pelo titular.
    retained["billing_events"] = int(
        conn.execute(
            sa.text(
                "SELECT count(*) FROM billing_events e JOIN subscriptions s "
                "ON s.id = e.subscription_id WHERE s.owner_uid = :u"
            ),
            {"u": uid},
        ).scalar_one()
    )
    return Plan(account_uid=uid, email=email, owned=owned, retained=retained)


def erase(conn: sa.Connection, alvo: str) -> tuple[Plan, str]:
    """Executa a anonimização numa transação. Devolve o plano aplicado e o pseudônimo gerado."""
    plano = build_plan(conn, alvo)
    uid = plano.account_uid
    # Aleatório e não registrado em lugar nenhum: sem tabela de volta, não há reidentificação.
    pseudonimo = f"anon-{secrets.token_hex(16)}"
    agora = datetime.now(UTC)

    conn.execute(
        sa.text(
            "INSERT INTO accounts (account_uid, email, created_at, last_seen_at) "
            "VALUES (:p, NULL, :agora, :agora)"
        ),
        {"p": pseudonimo, "agora": agora},
    )

    # 1) os snapshots: repontar + reduzir o payload aos números + carimbar. `payload - 'origin'`
    #    remove a proveniência capturada ({kind,id,name} — o `name` é texto do titular); o label é
    #    texto livre que ele digitou, então some inteiro.
    conn.execute(
        sa.text("""
            UPDATE snapshots
               SET owner_uid = :p,
                   payload = (payload - 'origin' - 'sellerName' - 'clientName'),
                   label = NULL,
                   anonymized_at = :agora
             WHERE owner_uid = :u AND anonymized_at IS NULL
        """),
        {"p": pseudonimo, "u": uid, "agora": agora},
    )

    # 2) o que permanece por obrigação fiscal, repontado
    for tabela in ("entitlement_grants", "subscriptions"):
        coluna = _owner_column(tabela)
        conn.execute(
            sa.text(f"UPDATE {tabela} SET {coluna} = :p WHERE {coluna} = :u"),  # noqa: S608
            {"p": pseudonimo, "u": uid},
        )

    # 3) o que é do titular e vai embora
    for tabela in OWNED_TABLES:
        conn.execute(
            sa.text(f"DELETE FROM {tabela} WHERE owner_uid = :u"),  # noqa: S608
            {"u": uid},
        )

    # 4) e por fim o titular
    conn.execute(sa.text("DELETE FROM accounts WHERE account_uid = :u"), {"u": uid})
    return plano, pseudonimo


def _print_plan(plano: Plan) -> None:
    print(f"conta: {plano.account_uid}  e-mail: {plano.email or '(sem e-mail)'}")
    print("\n  SERA APAGADO (conteudo do titular):")
    for t, n in plano.owned.items():
        print(f"    {t:<20} {n}")
    print("\n  SERA ANONIMIZADO E MANTIDO (registro contabil — retencao fiscal de 5 anos):")
    for t, n in plano.retained.items():
        print(f"    {t:<20} {n}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="erase_account", description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    p_prev = sub.add_parser("preview", help="mostra o que aconteceria; nao escreve nada")
    p_prev.add_argument("alvo")
    p_er = sub.add_parser("erase", help="anonimiza (IRREVERSIVEL)")
    p_er.add_argument("alvo")
    p_er.add_argument("--confirm", required=True, help="repita o alvo para confirmar")
    args = parser.parse_args(argv)

    engine = sa.create_engine(get_settings().database_url.get_secret_value())
    try:
        if args.cmd == "preview":
            with engine.connect() as conn:
                _print_plan(build_plan(conn, args.alvo))
            print("\n(preview — nada foi escrito)")
            return 0

        if args.confirm != args.alvo:
            raise EraseError("--confirm precisa repetir exatamente o alvo")
        with engine.begin() as conn:
            plano, pseudonimo = erase(conn, args.alvo)
        _print_plan(plano)
        print(f"\nANONIMIZADO. pseudonimo: {pseudonimo}")
        print("A correspondencia com o titular NAO foi guardada — nao ha como desfazer.")
        return 0
    except EraseError as exc:
        print(f"erro: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
