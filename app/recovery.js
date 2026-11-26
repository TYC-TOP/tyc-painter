// At most one project snapshot is encoded at a time. Edits during a save schedule another.
export function recoveryController({zip, write, warn}){
  let revision=0, saved=0, timer, running=false;
  async function save(){
    if(running || revision===saved) return;
    const target=revision;
    running=true;
    try{await write(await zip()); saved=target;}
    catch(error){warn(error.message);}
    finally{
      running=false;
      if(revision!==target) schedule();
    }
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(save,12000);}
  return {edited(){revision++;schedule();}, save};
}
