
/**
 * SECURITYMASTER INTELLIGENCE
 * Analisador de Rondas Eletrônicas
 * Versão 1.0
 *
 * Responsabilidades:
 * - Interpretar a sequência dos eventos
 * - Identificar falhas de boton
 * - Diferenciar falhas de início e finalização
 * - Verificar regularizações posteriores
 * - Preservar cliente, operador e relato
 *
 * Não realiza a auditoria das baixas.
 */

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function setorEhZero(setor) {
    return (
        setor === 0 ||
        setor === "0" ||
        setor === null ||
        setor === undefined ||
        setor === ""
    );
}

function obterTempo(evento) {
    if (evento.data instanceof Date) {
        return evento.data.getTime();
    }

    return null;
}

function ordenarEventos(eventos) {
    return eventos
        .map((evento, indice) => ({
            ...evento,
            ordemOriginal: indice
        }))
        .sort((a, b) => {
            const tempoA = obterTempo(a);
            const tempoB = obterTempo(b);

            if (tempoA === null || tempoB === null) {
                return a.ordemOriginal - b.ordemOriginal;
            }

            return (
                tempoA - tempoB ||
                a.ordemOriginal - b.ordemOriginal
            );
        });
}

function mesmoCliente(a, b) {
    if (a.codigoCliente && b.codigoCliente) {
        return String(a.codigoCliente) ===
            String(b.codigoCliente);
    }

    return a.nomeCliente === b.nomeCliente;
}

// ========================================
// ANÁLISE DAS FALHAS
// ========================================

export function analisarRondas(resultadoParser) {

    if (!resultadoParser ||
        !Array.isArray(resultadoParser.eventos)) {
        throw new Error(
            "Resultado do parser de rondas inválido."
        );
    }

    const eventos = ordenarEventos(
        resultadoParser.eventos
    );

    const falhasAnalisadas = [];

    // Estado da ronda por cliente.
    const estados = new Map();

    function chaveCliente(evento) {
        return String(
            evento.codigoCliente ||
            evento.nomeCliente ||
            "CLIENTE_DESCONHECIDO"
        );
    }

    function obterEstado(evento) {
        const chave = chaveCliente(evento);

        if (!estados.has(chave)) {
            estados.set(chave, {
                rondaAberta: false,
                inicio: null
            });
        }

        return estados.get(chave);
    }

    for (let indice = 0; indice < eventos.length; indice++) {

        const evento = eventos[indice];
        const estado = obterEstado(evento);

        // =================================
        // INÍCIO DA RONDA
        // =================================

        if (evento.tipo === "INICIO") {
            estado.rondaAberta = true;
            estado.inicio = evento;
            continue;
        }

        // =================================
        // FINAL DA RONDA
        // =================================

        if (evento.tipo === "FINAL") {
            estado.rondaAberta = false;
            estado.inicio = null;
            continue;
        }

        // =================================
        // EVENTOS NORMAIS DE BOTON
        // =================================

        if (evento.tipo === "PONTO_BATIDO") {
            continue;
        }

        // Somente falhas serão analisadas.
        if (evento.tipo !== "FALHA") {
            continue;
        }

        const analise = {
            id: evento.id,
            codigoCliente: evento.codigoCliente,
            nomeCliente: evento.nomeCliente,
            dataHora: evento.dataHora,
            setor: evento.setor,
            operador: evento.operador,
            relato: evento.relato,

            tipoFalha: null,
            descricaoFalha: null,

            regularizada: false,
            eventoRegularizacao: null,

            necessitaRevisao: false
        };

        // =================================
        // FALHA DE BOTON
        // =================================

        if (!setorEhZero(evento.setor)) {

            analise.tipoFalha = "BOTON";

            analise.descricaoFalha =
                `Ponto de ronda não acionado — setor ${evento.setor}`;

            // Procurar um acionamento posterior
            // do mesmo setor antes do encerramento
            // ou de um novo início de ronda.
            for (
                let proximoIndice = indice + 1;
                proximoIndice < eventos.length;
                proximoIndice++
            ) {
                const proximo = eventos[proximoIndice];

                if (!mesmoCliente(evento, proximo)) {
                    continue;
                }

                if (
                    proximo.tipo === "FINAL" ||
                    proximo.tipo === "INICIO"
                ) {
                    break;
                }

                if (
                    proximo.tipo === "PONTO_BATIDO" &&
                    String(proximo.setor) ===
                    String(evento.setor)
                ) {
                    analise.regularizada = true;
                    analise.eventoRegularizacao = {
                        tipo: proximo.tipo,
                        dataHora: proximo.dataHora
                    };

                    break;
                }
            }

            falhasAnalisadas.push(analise);
            continue;
        }

        // =================================
        // SETOR 0 OU VAZIO
        // =================================

        if (estado.rondaAberta) {

            analise.tipoFalha = "FINALIZACAO";

            analise.descricaoFalha =
                "Possível ausência de finalização da ronda.";

        } else {

            analise.tipoFalha = "INICIO";

            analise.descricaoFalha =
                "Possível atraso ou ausência de início da ronda.";
        }

        // =================================
        // BUSCAR REGULARIZAÇÃO POSTERIOR
        // =================================

        const tipoEsperado =
            analise.tipoFalha === "INICIO"
                ? "INICIO"
                : "FINAL";

        for (
            let proximoIndice = indice + 1;
            proximoIndice < eventos.length;
            proximoIndice++
        ) {
            const proximo = eventos[proximoIndice];

            if (!mesmoCliente(evento, proximo)) {
                continue;
            }

            if (proximo.tipo === tipoEsperado) {

                analise.regularizada = true;

                analise.eventoRegularizacao = {
                    tipo: proximo.tipo,
                    dataHora: proximo.dataHora
                };

                break;
            }

            // Se a ronda deveria terminar, mas
            // começou uma nova, não podemos afirmar
            // que a anterior foi finalizada.
            if (
                analise.tipoFalha === "FINALIZACAO" &&
                proximo.tipo === "INICIO"
            ) {
                break;
            }

            // Se a ronda deveria iniciar, mas
            // apareceu um final antes do início,
            // o histórico é inconclusivo.
            if (
                analise.tipoFalha === "INICIO" &&
                proximo.tipo === "FINAL"
            ) {
                break;
            }
        }

        falhasAnalisadas.push(analise);
    }

    return {
        cliente: resultadoParser.cliente,
        totalEventos: eventos.length,
        totalFalhas: falhasAnalisadas.length,

        totalFalhasBoton: falhasAnalisadas.filter(
            falha => falha.tipoFalha === "BOTON"
        ).length,

        totalFalhasInicio: falhasAnalisadas.filter(
            falha => falha.tipoFalha === "INICIO"
        ).length,

        totalFalhasFinalizacao: falhasAnalisadas.filter(
            falha => falha.tipoFalha === "FINALIZACAO"
        ).length,

        falhas: falhasAnalisadas
    };
}
