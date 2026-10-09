# Sistema de segurança do site

Este documento descreve o sistema de proteção implantado no site **Eric Koga | AI Engineer**.

## Objetivo

O sistema reduz alterações indesejadas feitas por extensões ou scripts injetados no navegador, especialmente:

- anúncios e overlays visíveis;
- iframes não autorizados;
- scripts externos injetados;
- alterações nos links do WhatsApp;
- alterações no conteúdo dos cards de preços;
- handlers inline adicionados dinamicamente.

Essa proteção é executada no navegador e melhora a integridade da página durante a sessão. Ela não substitui as proteções do servidor nem impede extensões com privilégios elevados de modificar o navegador.

## Arquivos envolvidos

| Arquivo | Responsabilidade |
| --- | --- |
| `security.js` | Executa as verificações, bloqueia alterações e registra tentativas |
| `index.html` | Carrega o guardião primeiro, declara o CSP e marca os cards protegidos |
| `README.md` | Contém instruções resumidas de manutenção e publicação |

## Ordem de execução

O carregamento atual no `<head>` é:

```html
<script src="security.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
```

O `security.js` deve continuar sendo o primeiro script do documento, antes do Tailwind, GSAP e de qualquer JavaScript inline. Isso permite que as proteções sejam configuradas antes da execução dos demais scripts da página.

O arquivo usa uma IIFE (`Immediately Invoked Function Expression`) com `'use strict'`, mantendo variáveis e funções internas fora do escopo global.

## Content Security Policy

O `index.html` contém o seguinte CSP:

```html
<meta http-equiv="Content-Security-Policy"
      content="script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com; object-src 'none'">
```

### Efeitos

- Permite scripts locais do próprio site.
- Permite o Tailwind carregado por `cdn.tailwindcss.com`.
- Permite o GSAP carregado por `cdnjs.cloudflare.com`.
- Bloqueia scripts de origens não autorizadas.
- Desabilita objetos incorporados com `object-src 'none'`.

O mesmo CSP deve ser configurado como cabeçalho HTTP no servidor de produção. O cabeçalho é mais confiável que uma meta tag e deve ser mantido alinhado com as dependências reais do site.

## Scripts autorizados

O guardião aceita:

- scripts do próprio domínio;
- `https://cdn.tailwindcss.com`;
- `https://cdnjs.cloudflare.com`;
- `https://wa.me`.

Um elemento `<script>` adicionado dinamicamente de outra origem é removido imediatamente. Scripts aninhados dentro de elementos recém-inseridos também são analisados.

## Monitoramento do DOM

O `security.js` cria `MutationObserver` para monitorar:

- `document.head`;
- `document.body`;
- nós adicionados;
- alterações de atributos.

Quando uma mutação suspeita é detectada, o script tenta removê-la sem interromper a navegação normal.

### Elementos bloqueados

São removidos automaticamente:

- `<iframe>` inseridos dinamicamente;
- scripts externos não autorizados;
- elementos com identificadores ou classes associadas a anúncios e overlays, como:
  - `ad`;
  - `ads`;
  - `advert`;
  - `sponsor`;
  - `popup`;
  - `pop-up`;
  - `overlay`;
  - `injected`;
  - `banner`;
- elementos posicionados como `fixed` que aparentem ser overlays externos.

O sistema não remove todo `div` novo. Essa decisão preserva componentes legítimos, ferramentas de acessibilidade, tradutores, gerenciadores de senhas e outros elementos normais da página.

## Proteção dos links do WhatsApp

Todos os links que contêm `wa.me` são registrados depois que o DOM inicial está disponível.

Para cada link, o sistema:

1. armazena o `href` original em uma `Map` privada;
2. tenta proteger a propriedade `href` com `Object.defineProperty`;
3. verifica o valor a cada 1 segundo;
4. restaura o endereço original caso ele seja alterado;
5. registra a tentativa no console.

O número protegido atualmente é:

```text
https://wa.me/5517992634306
```

Os parâmetros `text` específicos de cada CTA também são preservados.

## Proteção dos cards de preços

Os três cards da seção de preços possuem a classe:

```html
<article class="pricing-card ...">
```

O conteúdo HTML inicial de cada card é armazenado. Se o conteúdo de um card for alterado, o sistema restaura o HTML original e registra a ocorrência.

Os preços atualmente publicados na página são:

- R$150 — Debug Express;
- R$300 — Code Review & AI Boost;
- R$1.500 — MVP Sprint.

## Bloqueio de handlers injetados

O observer detecta atributos inline adicionados ou alterados, incluindo:

- `onclick`;
- `onload`;
- `onerror`;
- outros atributos cujo nome começa com `on`.

Esses atributos são removidos para evitar que uma extensão injete ações no contexto da página.

## Bloqueio de substituição de funções críticas

O script tenta tornar `window.eval` e `window.Function` não reconfiguráveis e não graváveis usando `Object.defineProperty`.

O objetivo é dificultar tentativas de substituir essas referências por versões controladas por código injetado. Isso não transforma o CSP em uma política sem `unsafe-inline`; o CSP e o código de proteção devem continuar sendo tratados como camadas complementares.

## Registro de tentativas

Cada bloqueio gera um aviso com timestamp usando `console.warn`, por exemplo:

```text
[2026-10-09T16:57:17.187Z] Security: Suspicious overlay or frame blocked
```

As tentativas são mantidas em memória por uma janela de 10 segundos.

Quando três ou mais tentativas são detectadas nessa janela, o site exibe uma notificação pequena:

```text
Security: external modification blocked
```

O toast:

- usa `role="status"`;
- não bloqueia cliques;
- fica no canto inferior direito;
- desaparece automaticamente após alguns segundos;
- não interrompe a experiência de navegação.

## Compatibilidade e preservação da experiência

O sistema foi desenhado para não bloquear indiscriminadamente alterações legítimas:

- não remove todos os elementos `div`;
- não bloqueia links internos;
- não interfere em atributos ARIA normais;
- não bloqueia os scripts oficiais do site;
- não altera os textos ou interações normais da página;
- não depende de bibliotecas externas;
- não cria requisições de rede adicionais.

Extensões de acessibilidade e gerenciadores de senhas podem continuar criando elementos legítimos, desde que não se apresentem como scripts externos, iframes ou overlays publicitários suspeitos.

## Desempenho

O arquivo é vanilla JavaScript e tem aproximadamente 5 KB. As verificações principais são:

- reativas, disparadas por mutações;
- uma verificação periódica dos links a cada 1.000 ms;
- sem polling contínuo do conteúdo inteiro da página;
- sem dependências adicionais;
- sem chamadas externas.

## Efeitos verificados

Durante a validação no navegador, foram confirmados os seguintes comportamentos:

- alteração de um `href` do WhatsApp é revertida;
- script externo não autorizado é removido;
- iframe suspeito é bloqueado;
- elemento com classe de anúncio é removido;
- handler `onclick` injetado é removido;
- os três `.pricing-card` continuam presentes;
- o toast aparece após múltiplas tentativas de alteração;
- o site continua carregando com Tailwind e GSAP.

## Limitações importantes

Esta é uma proteção no lado do cliente. Uma extensão com privilégios elevados, automação controlada pelo usuário ou ferramentas de desenvolvimento pode:

- desabilitar JavaScript;
- alterar o arquivo antes do carregamento;
- modificar o navegador fora do contexto da página;
- ignorar ou substituir mecanismos de proteção locais.

Por isso, esta solução não deve ser usada para proteger segredos, tokens, credenciais ou regras de negócio. Qualquer validação importante deve ocorrer no servidor.

## Recomendações para produção

1. Publicar o CSP também como cabeçalho HTTP.
2. Substituir `unsafe-inline` por nonce ou hashes quando o JavaScript inline for removido.
3. Hospedar localmente Tailwind e GSAP quando possível.
4. Restringir `script-src` às origens realmente utilizadas.
5. Adicionar `base-uri 'self'`, `frame-ancestors 'none'` e `form-action 'self'` após validar compatibilidade.
6. Monitorar os avisos de segurança sem expor dados sensíveis nos logs.
7. Revalidar o script sempre que novos widgets, analytics ou integrações forem adicionados.

## Manutenção

Ao alterar o número do WhatsApp, atualize:

- os links em `index.html`;
- a documentação deste arquivo;
- qualquer teste de integridade associado.

Ao adicionar um novo CDN, atualize simultaneamente:

- a lista `allowedScript` em `security.js`;
- a diretiva `script-src` do CSP;
- esta documentação.

Ao adicionar um novo card protegido, aplique a classe `.pricing-card` para que ele entre automaticamente na proteção de conteúdo.
