let EditorTeksta = function (divRef)
{
    if (divRef.tagName !== "DIV") throw new Error("Pogresan tip elementa!");
if (divRef.getAttribute("contenteditable") !== "true") throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");
    let editorDiv=divRef;
    function dajBrojRijeci() {

    
    let tekst = editorDiv.innerText.trim();

    
    let rijeci = tekst.split(/[\s,.]+/);
    rijeci = rijeci.filter(r => r.length > 0);
    let U = rijeci.length;


   
    let boldEl = editorDiv.querySelectorAll("b, strong");
    let B = 0;

    boldEl.forEach(b => {
        let tekstB = b.innerText.trim();
        let rijeciB = tekstB.split(/[\s,.]+/);
        rijeciB = rijeciB.filter(r => r.length > 0);
        B += rijeciB.length;
    });


   
    let italicEl = editorDiv.querySelectorAll("i, em");
    let I = 0;

    italicEl.forEach(i => {
        let tekstI = i.innerText.trim();
        let rijeciI = tekstI.split(/[\s,.]+/);
        rijeciI = rijeciI.filter(r => r.length > 0);
        I += rijeciI.length;
    });


    
    return { ukupno: U, boldiranih: B, italic: I };
}

  
 function dajUloge() {
    let linije = uzmiLinije();
    let uloge = [];
    let vidjene = new Set();

    for (let i = 0; i < linije.length; i++) {

        let linija = linije[i];

        if (linija.length === 0) continue;
        if (linija !== linija.toUpperCase()) continue;
        if (!/[A-ZŠĐŽČĆ]/.test(linija)) continue;
        if (/[0-9]/.test(linija)) continue;
        if (/[\.,:]/.test(linija)) continue;

        let j = i + 1;
        let validna = false;

        while (j < linije.length) {
            let next = linije[j].trim();

            if (next === "") { j++; continue; }
            if (/^\(.*\)$/.test(next)) { j++; continue; }

            if (next === next.toUpperCase()) break;

            validna = true;
            break;
        }

        if (validna && !vidjene.has(linija)) {
            vidjene.add(linija);
            uloge.push(linija);
        }
    }

    return uloge;
}


let rezultat = [];

for (let A of uloge) {
    for (let B of uloge) {

        if (A === B) continue;

        let diff = razlikaUKarakterima(A, B);

        
        let maxDiff;

        if (A.length > 5 && B.length > 5) {
            maxDiff = 2;
        } else {
            maxDiff = 1;
        }

        if (diff > maxDiff) continue;

        
        if (brojac[B] < 4) continue;

       
        if (brojac[B] < brojac[A] + 3) continue;

        
        if (!rezultat.includes(A)) {
            rezultat.push(A);
        }
    }
}

return rezultat;
function brojLinijaTeksta(uloga) {
    if (!uloga) return 0;

    uloga = uloga.toUpperCase();
    let linije = uzmiLinije();

    let brojac = 0;

    for (let i = 0; i < linije.length; i++) {
        let linija = linije[i].trim();

        if (linija === uloga) {
            let j = i + 1;

            while (j < linije.length) {
                let next = linije[j].trim();

                
                if (next === "") break;
                if (next === next.toUpperCase()) break;
               if (next.startsWith("(") && next.endsWith(")")) {
      j++;
      continue;
}


                
                brojac++;

                j++;
            }
        }
    }

    return brojac;
}

function scenarijUloge(uloga) {
    if (!uloga) return [];
    uloga = uloga.toUpperCase();

    let sveReplike = parsirajTekst();
    let moje = sveReplike.filter(r => r.uloga === uloga);

    if (moje.length === 0) return [];

    let rezultat = [];

    for (let r of moje) {

       
        let indexUSvim = sveReplike.indexOf(r);

        // PRETHODNI
        let prethodni = null;
        if (indexUSvim > 0) {
            let p = sveReplike[indexUSvim - 1];
            if (p.scena === r.scena) {
                prethodni = {
                    uloga: p.uloga,
                    linije: p.linije
                };
            }
        }

        // SLJEDEĆI
        let sljedeci = null;
        if (indexUSvim < sveReplike.length - 1) {
            let s = sveReplike[indexUSvim + 1];
            if (s.scena === r.scena) {
                sljedeci = {
                    uloga: s.uloga,
                    linije: s.linije
                };
            }
        }

        // TRENUTNI
        let trenutni = {
            uloga: r.uloga,
            linije: r.linije
        };

        
        rezultat.push({
            scena: r.scena,
            pozicijaUTekstu: r.pozicijaUTekstu,
            prethodni: prethodni,
            trenutni: trenutni,
            sljedeci: sljedeci
        });
    }

    return rezultat;
}

function grupisiUloge() {
    let sveReplike = parsirajTekst();

    if (sveReplike.length === 0) return [];

    let rezultat = [];
    let trenutnaScena = null;
    let trenutniSegment = 0;
    let ulogeSegmenta = [];

    for (let r of sveReplike) {

        // nova scena → prekid segmenta
        if (r.scena !== trenutnaScena) {

            // ako postoji prethodna grupa → sačuvaj je
            if (ulogeSegmenta.length > 0) {
                rezultat.push({
                    scena: trenutnaScena,
                    segment: trenutniSegment,
                    uloge: ulogeSegmenta.slice()
                });
            }

            // inicijalizacija nove scene
            trenutnaScena = r.scena;
            trenutniSegment = 1;
            ulogeSegmenta = [];
        }

        // dodaj ulogu u segment ako već nije dodana
        if (!ulogeSegmenta.includes(r.uloga)) {
            ulogeSegmenta.push(r.uloga);
        }
    }

    // dodaj POSLJEDNJI segment
    if (ulogeSegmenta.length > 0) {
        rezultat.push({
            scena: trenutnaScena,
            segment: trenutniSegment,
            uloge: ulogeSegmenta.slice()
        });
    }

    return rezultat;
}



  
  function formatirajTekst() {}


//pomoćne funkcije
 function uzmiLinije() {
    let tekst = editorDiv.innerText.replace(/\r/g, "");
    let linije = tekst.split("\n");
    return linije.map(l => l.trim());
}
function razlikaUKarakterima(a, b) {
    if (a.length !== b.length) return 100;

    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) diff++;
    }
    return diff;
}
function formatirajTekst(komanda) {

    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;

    let range = sel.getRangeAt(0);

    // provjera da li selekcija postoji (nije prazna)
    if (range.collapsed) return false;

   
    function jeUnutarEditora(node) {
        while (node) {
            if (node === editorDiv) return true;
            node = node.parentNode;
        }
        return false;
    }

    // selekcija mora biti skroz unutar editora
    if (!jeUnutarEditora(range.startContainer) ||
        !jeUnutarEditora(range.endContainer)) {
        return false;
    }

   
    if (komanda === "bold") document.execCommand("bold");
    else if (komanda === "italic") document.execCommand("italic");
    else if (komanda === "underline") document.execCommand("underline");
    else return false;

    return true;
}

function parsirajTekst() {
    let linije = uzmiLinije();
    let rezultat = [];

    let trenutnaScena = "NEPOZNATA SCENA";
    let pozicija = 0;
    let i = 0;

    while (i < linije.length) {

        let linija = linije[i].trim();

        
        if (
            (linija.startsWith("INT.") || linija.startsWith("EXT.")) &&
            linija === linija.toUpperCase()
        ) {
            trenutnaScena = linija;
            pozicija = 0;
            i++;
            continue;
        }

        
        if (jeUloga(linija)) {
            let uloga = linija;
            let j = i + 1;
            let linijeGovora = [];

            while (j < linije.length) {
                let next = linije[j].trim();

                if (next === "") break;
                if (jeUloga(next)) break;
                if (next.startsWith("(") && next.endsWith(")")) { j++; continue; }
                if (
                    (next.startsWith("INT.") || next.startsWith("EXT.")) &&
                    next === next.toUpperCase()
                ) break;

                linijeGovora.push(next);
                j++;
            }

            if (linijeGovora.length > 0) {
                pozicija++;
                rezultat.push({
                    scena: trenutnaScena,
                    uloga: uloga,
                    linije: linijeGovora,
                    pozicijaUTekstu: pozicija
                });
            }

            i = j;
            continue;
        }

        i++;
    }

    return rezultat;
}


function jeUloga(linija) {
    if (linija.length === 0) return false;
    if (linija !== linija.toUpperCase()) return false;
    if (!/[A-ZŠĐŽČĆ]/.test(linija)) return false;
    if (/[0-9]/.test(linija)) return false;
    if (/[\.,:]/.test(linija)) return false;
    return true;
}



    return {
     dajBrojRijeci: dajBrojRijeci,
     dajUloge: dajUloge,
     pogresnaUloga: pogresnaUloga,
     brojLinijaTeksta: brojLinijaTeksta,
     scenarijUloge: scenarijUloge,
     grupisiUloge: grupisiUloge,
     formatirajTekst: formatirajTekst
  };
}
