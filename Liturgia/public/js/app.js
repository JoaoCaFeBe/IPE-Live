/**
 * app.js — utilitários extraídos de lib/App.js e lib/funcoesJC.js
 * Necessários para o módulo de liturgia funcionar sem o framework PHP.
 */

/* ── Atalhos de query ──────────────────────────────────────────────────── */
var query = document.querySelector.bind(document);
var queryAll = document.querySelectorAll.bind(document);

/* ── String helpers ────────────────────────────────────────────────────── */
String.prototype.toAllFirstCase = function () {
    return this.toLowerCase().replace(/(^\w{1})|(\s+\w{1})/g,
        letter => letter.toUpperCase());
};

/* ── Funções globais usadas no capa.js ─────────────────────────────────── */
function capitalize(str, lower = false) {
    return (lower ? str.toLowerCase() : str)
        .replace(/(?:^|\s|["'([{])+\S/g, match => match.toUpperCase());
}

function formatDate(format = 'yyyymmddhhiiss', date = new Date()) {
    const map = {
        mm: ('0' + (date.getMonth() + 1)).slice(-2),
        dd: ('0' + date.getDate()).slice(-2),
        yy: date.getFullYear().toString().slice(-2),
        yyyy: date.getFullYear(),
        hh: ('0' + date.getHours()).slice(-2),
        ii: ('0' + date.getMinutes()).slice(-2),
        ss: ('0' + date.getSeconds()).slice(-2)
    };
    return format.replace(/mm|dd|yy|yyyy|hh|ii|ss/gi, m => map[m]);
}

/* ── Extensões jQuery ──────────────────────────────────────────────────── */
$.passarObjeto = obj => JSON.parse(JSON.stringify(obj));

$.downloadObj = (content, fileName, contentType) => {
    const json = JSON.stringify(content);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: contentType }));
    a.download = fileName;
    a.click();
};

/** Filtra <ul> ou <table> pelo texto digitado */
$.fn.filtra = function (texto, tamanho = 3) {
    this.each(function () {
        const $el = $(this);
        if (texto.length >= tamanho) {
            if (this.nodeName === 'TABLE') {
                $el.find('tbody>tr').each(function () {
                    $(this).css('display',
                        $(this).text().toUpperCase().includes(texto.toUpperCase())
                            ? 'table-row' : 'none');
                });
            } else {
                $el.find('li').each(function () {
                    $(this).css('display',
                        $(this).text().toUpperCase().includes(texto.toUpperCase()) ? '' : 'none');
                });
            }
        } else {
            if (this.nodeName === 'TABLE') $el.find('tbody>tr').css('display', 'table-row');
            else $el.find('li').css('display', '');
        }
    });
    return this;
};

/* ── Bootbox — locale PT-BR ────────────────────────────────────────────── */
bootbox.addLocale('pt-BR', { OK: 'Ok', CONFIRM: 'Confirmar', CANCEL: 'Cancelar' });
bootbox.setDefaults({ locale: 'pt-BR' });
