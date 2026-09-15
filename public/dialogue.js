let root=null,portrait=null,speaker=null,text=null,hint=null,choices=null,timer=null,session=null,index=0,visible='';
const $=s=>document.querySelector(s);
function ensure(){
  root=$('#dialogueBox');portrait=$('#dialoguePortrait');speaker=$('#dialogueSpeaker');text=$('#dialogueText');hint=$('#dialogueHint');choices=$('#dialogueChoices');
  return !!root;
}
function finishLine(){if(!session)return;clearInterval(timer);visible=session.lines[index]||'';text.textContent=visible;showChoicesOrHint()}
function showChoicesOrHint(){
  choices.innerHTML='';const last=index>=session.lines.length-1;
  if(last&&session.choices?.length){hint.textContent='';for(const c of session.choices){const b=document.createElement('button');b.className='dialogue-choice';b.textContent=c.label;b.onclick=()=>{closeDialogue();c.action?.()};choices.appendChild(b)}}
  else hint.textContent=last?'ENTER · CLOSE':'ENTER · CONTINUE';
}
function typeLine(){
  clearInterval(timer);visible='';text.textContent='';choices.innerHTML='';hint.textContent='';const line=session.lines[index]||'';let i=0;
  timer=setInterval(()=>{visible+=line[i++]||'';text.textContent=visible;if(i>=line.length){clearInterval(timer);showChoicesOrHint()}},16);
}
export function showDialogue(opts){
  if(!ensure())return false;session={lines:(opts.lines||[]).filter(Boolean),choices:opts.choices||[],onClose:opts.onClose};index=0;
  speaker.textContent=opts.speaker||'WORLDWALKER';portrait.src=opts.portrait||'';portrait.alt=opts.speaker||'';portrait.classList.toggle('hidden',!opts.portrait);root.classList.remove('hidden');root.classList.add('open');typeLine();return true;
}
export function advanceDialogue(){
  if(!session)return false;const line=session.lines[index]||'';if(visible.length<line.length){finishLine();return true}
  if(index<session.lines.length-1){index++;typeLine();return true}
  if(!session.choices?.length){closeDialogue();return true}return true;
}
export function closeDialogue(){
  if(!session)return;clearInterval(timer);const done=session.onClose;session=null;root?.classList.remove('open');root?.classList.add('hidden');choices&&(choices.innerHTML='');hint&&(hint.textContent='');done?.();
}
export function isDialogueOpen(){return !!session}
