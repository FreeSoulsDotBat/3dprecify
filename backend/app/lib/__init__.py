"""`app.lib` — folha SEM dependências (019/PR-D, T063/N4).

Funções puras de domínio que os routers e o gêmeo TS precisam concordar caso a caso. Não importa
NADA de `app.*` (contrato `[[tool.importlinter.contracts]]` em `pyproject.toml`, mesma forma de
`app.validation`): a normalização de nome é chamada de dentro de uma transação de kit, e um ciclo
`api -> lib -> api` seria descoberto só em runtime.
"""
