# Clone Finder

Página para localizar em qual servidor SQL (FLASH, FENIX, CICLOPE ou WOLVERINE)
está o banco de cada cliente e abrir o i4proclone com um clique.

## Como usar

**Sem servidor:** dê um duplo clique em `index.html`. Aberta direto do disco
(`file://`), a página lê os dados de `data/clientes.js`, carregado via
`<script>`, porque o navegador bloqueia AJAX em arquivos locais. Funciona
offline: o jQuery está em `js/`. Sem internet, apenas a fonte Inter (Google
Fonts) não carrega e a página usa a fonte do sistema.

Servida por HTTP, a página lê `data/clientes.json` por AJAX (com
`data/clientes.js` como reserva). Opções:

1. **PowerShell** (sem instalar nada):
   ```powershell
   .\iniciar.ps1
   ```
   Abre automaticamente `http://localhost:8080`.

2. **VS Code Live Server**: clique com o botão direito em `index.html` > *Open with Live Server*.

## Atualizar a lista de clientes

Rode o script abaixo. Ele consulta `sys.databases` em FLASH, FENIX, CICLOPE e
WOLVERINE com autenticação integrada do Windows (somente leitura) e regrava
`data/clientes.json` e `data/clientes.js` com todos os bancos terminados em `_erp_head`:

```powershell
.\gerar-clientes.ps1
```

Se algum servidor não responder, o script avisa e grava apenas os demais.
Se nenhum responder, o arquivo atual não é alterado.

Um mesmo banco pode existir em mais de um servidor; nesse caso aparece uma
linha para cada servidor.

## Adicionar cliente pela tela

O botão **Adicionar cliente** abre um cadastro com os mesmos campos do JSON:

- **Cliente**: letras, números, `_` e `-`.
- **Banco de dados**: preenchido automaticamente como `<cliente>_erp_head`, mas pode ser alterado.
- **Servidor**: lista fechada com os servidores de `servidores` no JSON (ou
  FLASH, FENIX, CICLOPE e WOLVERINE). Não é possível digitar outro valor.

Não é aceito um banco que já esteja cadastrado no mesmo servidor.

Como a página não tem servidor para gravar arquivos, o cliente cadastrado fica
salvo **apenas no navegador de quem cadastrou** (`localStorage`), marcado como
*novo*, com um **×** para removê-lo. Para que todos vejam, clique em
**Exportar**: são baixados `clientes.json` e `clientes.js` atualizados, que
devem substituir os arquivos da pasta `data`. Depois disso, a marca *novo*
desaparece sozinha.

> O `gerar-clientes.ps1` regrava os arquivos a partir do SQL. Clientes
> cadastrados à mão cujo banco não exista nos servidores serão perdidos.

## Formato do JSON

Também é possível editar `data/clientes.json` manualmente. Se for usar a
página sem servidor, aplique a mesma alteração em `data/clientes.js`, que contém
o mesmo JSON precedido de `window.CLONE_FINDER_DADOS =`:

```json
{
  "clientes": [
    { "cliente": "acme", "banco": "acme_erp_head", "servidor": "FLASH" }
  ]
}
```

| Campo      | Descrição                              |
|------------|----------------------------------------|
| `cliente`  | Nome do cliente (usado na pesquisa)    |
| `banco`    | Nome do banco (`nomeCliente_erp_head`) |
| `servidor` | FLASH, FENIX, CICLOPE ou WOLVERINE (usado na pesquisa) |

A lista é ordenada por cliente automaticamente. A pesquisa filtra por nome do
cliente ou por servidor, sem diferenciar maiúsculas e acentos.

## Botões

| Botão  | Abre em nova aba                  | Configuração      |
|--------|-----------------------------------|-------------------|
| Clonar | `https://<servidor>/i4proclone/`  | `CONFIG.urlClone` |
| Head   | `https://<servidor>/<cliente>/`   | `CONFIG.urlHead`  |

As constantes ficam no topo de `js/app.js`.

## Estrutura

```
index.html          Página
css/style.css       Estilos (paleta roxo + laranja)
js/app.js           Carga AJAX e filtro dinâmico (jQuery)
js/jquery-3.7.1.min.js  jQuery local (dispensa CDN)
data/clientes.json  Dados dos clientes (usado via HTTP)
data/clientes.js    Mesmos dados em JS (usado ao abrir direto do disco)
iniciar.ps1         Servidor HTTP local
gerar-clientes.ps1  Gera data/clientes.json a partir dos servidores SQL
```
