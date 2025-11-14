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

  
  function dajUloge() {}
  function pogresnaUloga() {}
  function brojLinijaTeksta() {}
  function scenarijUloge() {}
  function grupisiUloge() {}
  function formatirajTekst() {}



  function parsirajTekst() {}

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
