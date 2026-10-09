# Clone Finder

Página para localizar em qual servidor SQL (FLASH, FENIX, CICLOPE ou WOLVERINE)
está o banco de cada cliente e abrir o i4proclone com um clique.

**Acesse:** https://i4pro-gapinto.github.io/CloneFinder/

## Como usar

1. Digite parte do nome do cliente ou do servidor no campo de pesquisa.
   A lista é filtrada enquanto você digita, sem diferenciar maiúsculas e acentos.
   `Esc` ou o **×** limpam a pesquisa.
2. Na linha do cliente, use os botões:

| Botão  | Abre em nova aba                  | Configuração      |
|--------|-----------------------------------|-------------------|
| Clonar | `https://<servidor>/i4proclone/`  | `CONFIG.urlClone` |
| Head   | `https://<servidor>/<cliente>/`   | `CONFIG.urlHead`  |

As constantes ficam no topo de `js/app.js`.

### Abrir localmente

Também dá para usar sem a internet e sem servidor: baixe o repositório e dê um
duplo clique em `index.html`. O jQuery está incluído em `js/`; sem internet,
apenas a fonte Inter não carrega e a página usa a fonte do sistema.

## Atualizar a lista de clientes

Os dados ficam em dois arquivos com o **mesmo conteúdo**:

| Arquivo              | Usado quando                                              |
|----------------------|-----------------------------------------------------------|
| `data/clientes.json` | A página é acessada pelo GitHub Pages (carregado por AJAX) |
| `data/clientes.js`   | O `index.html` é aberto direto do disco (o navegador bloqueia AJAX em `file://`) |

Para incluir, alterar ou remover um cliente:

1. Edite `data/clientes.json`.
2. Aplique a mesma alteração em `data/clientes.js`. Ele contém o mesmo JSON,
   precedido de `window.CLONE_FINDER_DADOS =` e terminado em `;`.
3. Faça commit e push na branch publicada. O GitHub Pages atualiza o site em
   alguns minutos.

Formato:

```json
{
  "geradoEm": "2026-10-08T12:23:10",
  "servidores": ["FLASH", "FENIX", "CICLOPE", "WOLVERINE"],
  "clientes": [
    { "cliente": "acme", "banco": "acme_erp_head", "servidor": "FLASH" }
  ]
}
```

| Campo        | Descrição                                                  |
|--------------|------------------------------------------------------------|
| `geradoEm`   | Data da última atualização (informativo)                   |
| `servidores` | Servidores existentes                                      |
| `cliente`    | Nome do cliente (usado na pesquisa e na URL do Head)       |
| `banco`      | Nome do banco (`<cliente>_erp_head`)                       |
| `servidor`   | Um dos valores de `servidores` (usado na pesquisa e nas URLs) |

A ordem dos clientes no arquivo não importa: a página ordena por cliente.
Um mesmo banco pode existir em mais de um servidor; nesse caso, inclua uma
entrada para cada servidor.

## Cadastro pela tela (desativado)

O código para cadastrar clientes pela própria página continua em `index.html`
e `js/app.js`, mas o botão **Adicionar cliente** está comentado no
`index.html`. Para reativar, remova o comentário `<!-- ... -->` do botão
`#botao-adicionar`.

Quando ativo, o cadastro pede cliente, banco (sugerido como
`<cliente>_erp_head`) e servidor, escolhido numa lista fechada com os valores de
`servidores`. Como o site é estático, o cliente cadastrado fica salvo **apenas
no navegador de quem cadastrou** (`localStorage`). O botão **Exportar** baixa
`clientes.json` e `clientes.js` atualizados, que devem substituir os arquivos da
pasta `data` no repositório.

## Estrutura

```
index.html              Página
css/style.css           Estilos (paleta roxo + laranja)
js/app.js               Carga dos dados, filtro e cadastro (jQuery)
js/jquery-3.7.1.min.js  jQuery local (dispensa CDN)
data/clientes.json      Dados dos clientes (GitHub Pages)
data/clientes.js        Mesmos dados em JS (abrir direto do disco)
```
