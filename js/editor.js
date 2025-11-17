let div =document.getElementById("divEditor");
let editor;
try{
    editor=EditorTeksta(div);
}catch(e){
    console.log(e.message);
}