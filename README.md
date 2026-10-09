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

## Adicionar cliente pela tela

O botão **Adicionar cliente** abre um cadastro com os mesmos campos do JSON:

- **Cliente**: letras, números, `_` e `-`.
- **Banco de dados**: preenchido automaticamente como `<cliente>_erp_head`, mas pode ser alterado.
- **Servidor**: lista fechada com os servidores de `servidores` no JSON (ou
  FLASH, FENIX, CICLOPE e WOLVERINE). Não é possível digitar outro valor.

Não é aceito um banco que já esteja cadastrado no mesmo servidor.

O cliente cadastrado fica salvo **apenas no navegador de quem cadastrou**
(`localStorage`) e aparece com a marca **LOCAL**. O **×** ao lado remove.

## Alterar cliente pela tela

O lápis ao lado do nome de qualquer cliente abre o mesmo formulário, já
preenchido. A alteração também fica **apenas no navegador** (`localStorage`);
o `clientes.json` nunca é modificado pela página.

- Cliente cadastrado localmente: a alteração substitui o cadastro local.
- Cliente do `clientes.json`: aparece com a marca **ALTERADO**. Ao passar o
  mouse na marca, a página mostra os valores originais do arquivo, e o botão
  de desfazer (↺) volta a usá-los.

Alterações cujo cliente original saiu do `clientes.json`, ou que ficaram iguais
ao arquivo, são descartadas automaticamente ao abrir a página.

## Estrutura

```
index.html              Página
css/style.css           Estilos (paleta roxo + laranja)
js/app.js               Carga dos dados, filtro e cadastro (jQuery)
js/jquery-3.7.1.min.js  jQuery local (dispensa CDN)
data/clientes.json      Dados dos clientes (GitHub Pages)
data/clientes.js        Mesmos dados em JS (abrir direto do disco)
```
