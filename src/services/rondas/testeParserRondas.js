
import { parserRondas } from "./parserRondas.js";

/**
 * SECURITYMASTER INTELLIGENCE
 * Teste do Parser de Rondas Eletrônicas
 * Versão 1.0
 */

export async function testarParserRondas(arquivo) {

    if (!arquivo) {
        console.warn("Nenhum arquivo HTML selecionado.");
        return;
    }

    try {
        const html = await arquivo.text();

        const resultado = parserRondas(html);

        console.log("================================");
        console.log("TESTE DE RONDAS ELETRÔNICAS");
        console.log("================================");

        console.log("Cliente:", resultado.cliente);
        console.log("Total de eventos:", resultado.totalEventos);
        console.log("Total de falhas:", resultado.totalFalhas);

        console.table(
            resultado.eventos.map(evento => ({
                Data: evento.dataHora,
                Tipo: evento.tipo,
                Setor: evento.setor,
                Falha: evento.falha ? "SIM" : "NÃO",
                Operador: evento.operador || "-"
            }))
        );

        console.log("EVENTOS DE FALHA:");

        resultado.falhas.forEach((falha, indice) => {
            console.group(`Falha ${indice + 1}`);

            console.log("Data:", falha.dataHora);
            console.log("Setor:", falha.setor);
            console.log("Operador:", falha.operador);
            console.log("Relato:", falha.relato);

            console.groupEnd();
        });

        return resultado;

    } catch (erro) {
        console.error(
            "Erro ao testar parser de rondas:",
            erro
        );

        throw erro;
    }
}
