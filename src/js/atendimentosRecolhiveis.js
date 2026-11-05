
/*
========================================
SECURITYMASTER INTELLIGENCE
Atendimentos Recolhíveis - Versão 1.1
========================================

Objetivo:
Minimizar a seção Atendimentos da
Auditoria Operacional.

Preserva:
- Indicadores gerais
- Resumo dos operadores
- Filtros existentes
- Cartões dos atendimentos
- Detalhes individuais
- Regras de auditoria
========================================
*/

(function () {

    "use strict";

    const CLASSE_SECAO = "atendimentos-recolhiveis";

    function criarSecaoRecolhivel(tituloOriginal) {

        const container = tituloOriginal.parentElement;

        if (!container) {
            return;
        }

        // Impede duplicação.
        if (
            container.querySelector(
                "." + CLASSE_SECAO
            )
        ) {
            return;
        }

        const secao = document.createElement("details");

        secao.className =
            "grupo-ronda-recolhivel " + CLASSE_SECAO;

        secao.open = false;

        // Cabeçalho da seção.
        const cabecalho = document.createElement("summary");

        const titulo = document.createElement("span");

        titulo.className = "titulo-grupo-ronda";
        titulo.textContent = "Atendimentos";

        const controle = document.createElement("span");

        controle.className = "controle-grupo-ronda";
        controle.textContent = "Expandir ▼";

        cabecalho.append(titulo, controle);

        // Conteúdo que ficará minimizado.
        const conteudo = document.createElement("div");

        conteudo.className = "conteudo-grupo-ronda";

        // Coloca a seção no lugar do título original.
        tituloOriginal.before(secao);

        // Transfere os elementos que aparecem
        // depois do título para dentro da seção.
        let elemento = tituloOriginal.nextElementSibling;

        while (elemento) {

            const proximo = elemento.nextElementSibling;

            conteudo.appendChild(elemento);

            elemento = proximo;
        }

        // Remove somente o título antigo.
        tituloOriginal.remove();

        secao.append(cabecalho, conteudo);

        // Atualiza o texto do controle.
        secao.addEventListener("toggle", function () {

            controle.textContent = secao.open
                ? "Recolher ▲"
                : "Expandir ▼";

        });

        console.log(
            "[AUDITORIA] Seção Atendimentos minimizada."
        );
    }

    function verificarAtendimentos() {

        const dashboard = document.getElementById(
            "dashboard"
        );

        if (!dashboard) {
            return;
        }

        const resultado = dashboard.querySelector(
            "#resultadoAuditoria"
        );

        if (!resultado) {
            return;
        }

        // Evita modificar uma seção já configurada.
        if (
            resultado.querySelector(
                "." + CLASSE_SECAO
            )
        ) {
            return;
        }

        // Localiza o título da lista de atendimentos.
        const titulos = resultado.querySelectorAll(
            "h2, h3, h4"
        );

        const tituloAtendimentos = Array.from(
            titulos
        ).find(function (titulo) {

            return titulo.textContent
                .trim()
                .toLowerCase() === "atendimentos";

        });

        if (!tituloAtendimentos) {
            return;
        }

        criarSecaoRecolhivel(tituloAtendimentos);
    }

    function iniciarObservador() {

        const dashboard = document.getElementById(
            "dashboard"
        );

        if (!dashboard) {

            console.warn(
                "[AUDITORIA] Dashboard não encontrado."
            );

            return;
        }

        // Observa o carregamento dos módulos e
        // a geração dos resultados da auditoria.
        const observador = new MutationObserver(
            function () {

                verificarAtendimentos();

            }
        );

        observador.observe(dashboard, {
            childList: true,
            subtree: true
        });

        verificarAtendimentos();

        console.log(
            "[AUDITORIA] Observador de atendimentos iniciado."
        );
    }

    // Aguarda a estrutura inicial da página.
    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            iniciarObservador
        );

    } else {

        iniciarObservador();

    }

})();
