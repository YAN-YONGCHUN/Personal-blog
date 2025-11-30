const btn=document.getElementById('hamburger');
const menu=document.getElementById('menu');
if(btn&&menu){btn.addEventListener('click',()=>{menu.classList.toggle('open')})}

// Dropdown logic
document.querySelectorAll('.dropdown > a').forEach(trigger=>{
  trigger.addEventListener('click',(e)=>{
    e.preventDefault();
    const parent=trigger.parentElement;
    parent.classList.toggle('open');
  })
})

const tabs=document.querySelectorAll('.algo-tab');
if(tabs.length){
  tabs.forEach(t=>t.addEventListener('click',()=>{
    const target=t.getAttribute('data-target');
    const problems=document.getElementById('problems');
    const algorithms=document.getElementById('algorithms');
    if(target==='problems'){problems.style.display='';algorithms.style.display='none'}
    else{problems.style.display='none';algorithms.style.display=''}
    tabs.forEach(x=>x.classList.remove('btn-primary'));tabs.forEach(x=>x.classList.remove('btn-outline'));
    tabs.forEach(x=>x.classList.add('btn-outline'));
    t.classList.remove('btn-outline');t.classList.add('btn-primary');
  }))
}

// Code Toggle Logic
const toggleBtns = document.querySelectorAll('.toggle-code');
toggleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const container = btn.nextElementSibling;
    if (container.style.display === 'none') {
      container.style.display = 'block';
      btn.textContent = '收起实现';
      // Optional: Add animation class here if we want smooth transitions
    } else {
      container.style.display = 'none';
      btn.textContent = '查看实现';
    }
  });
});
