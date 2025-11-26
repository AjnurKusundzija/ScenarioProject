document.addEventListener('DOMContentLoaded', function () {
    let div = document.getElementById('divEditor');
    let poruke = document.getElementById('poruke');
    
    function show(msg) {
        poruke.textContent = msg;
    }

    function formatGrupa(grupa) {
        return grupa.scena + ' [segment ' + grupa.segment + ']: ' + grupa.uloge.join(', ');
    }

    function formatScenarij(stavka) {
        const linije = stavka.trenutni.linije.replace(/\n/g, ' / ');
        const prethodni = stavka.prethodni ? (stavka.prethodni.uloga + ': ' + stavka.prethodni.linije.replace(/\n/g, ' / ')) : 'null';
        const sljedeci = stavka.sljedeci ? (stavka.sljedeci.uloga + ': ' + stavka.sljedeci.linije.replace(/\n/g, ' / ')) : 'null';
        return 'Scena: ' + stavka.scena +
            ' | pozicija: ' + stavka.pozicijaUTekstu +
            ' | uloga: ' + stavka.trenutni.uloga +
            ' | linije: ' + linije +
            ' | prethodni: ' + prethodni +
            ' | sljedeci: ' + sljedeci;
    }
    
    let editor;
    try {
        editor = EditorTeksta(div);
    } catch (e) {
        show('Greška pri inicijalizaciji editora: ' + e.message);
        return;
    }
    
    
    document.getElementById('btnBrojRijeci').addEventListener('click', function () {
        let res = editor.dajBrojRijeci();
        show('Ukupno: ' + res.ukupno + ', Bold: ' + res.boldiranih + ', Italic: ' + res.italic);
    });
    
    document.getElementById('btnUloge').addEventListener('click', function () {
        let res = editor.dajUloge();
        show(res.length ? res.join(', ') : 'Nema pronađenih uloga');
    });
    
    document.getElementById('btnPogresne').addEventListener('click', function () {
        let res = editor.pogresnaUloga();
        show(res.length ? 'Potencijalno pogrešne uloge: ' + res.join(', ') : 'Nema potencijalno pogrešnih imena');
    });
    
    document.getElementById('btnGrupisi').addEventListener('click', function () {
        let res = editor.grupisiUloge();
        show(res.length ? res.map(formatGrupa).join('\n') : 'Nema grupa za prikaz');
    });
    
    document.getElementById('btnBrojLinija').addEventListener('click', function () {
        let u = prompt('Unesite ime uloge (kao u tekstu):');
        if (u === null) return;
        let res = editor.brojLinijaTeksta(u);
        show('Broj linija za ulogu "' + u + '": ' + res);
    });
    
    document.getElementById('btnScenarijUloge').addEventListener('click', function () {
        let u = prompt('Unesite ime uloge (može mala/velika slova):');
        if (u === null) return;
        let res = editor.scenarijUloge(u);
        show(res.length ? res.map(formatScenarij).join('\n\n') : 'Nema replika za tu ulogu');
    });

    document.getElementById('btnBold').addEventListener('click', function () {
        let ok = editor.formatirajTekst('bold');
        show(ok ? 'Formatirano (bold).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
    
    document.getElementById('btnItalic').addEventListener('click', function () {
        let ok = editor.formatirajTekst('italic');
        show(ok ? 'Formatirano (italic).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
    
    document.getElementById('btnUnderline').addEventListener('click', function () {
        let ok = editor.formatirajTekst('underline');
        show(ok ? 'Formatirano (underline).' : 'Nije selektovano ili selekcija nije unutar editora.');
    });
});

