function qs(name){const params=new URLSearchParams(location.search);return params.get(name)}
const categorySelect=document.getElementById('categorySelect');
const papersGrid=document.getElementById('papersGrid');
const pdfFrame=document.getElementById('pdfFrame');
const currentPaperTitle=document.getElementById('currentPaperTitle');

async function loadPapers(){
  try{
    const resp=await fetch('./assets/papers.json');
    const all=await resp.json();
    const initial=qs('category')||'全部';
    categorySelect.value=initial;
    render(all,initial);
    categorySelect.addEventListener('change',()=>render(all,categorySelect.value));
  }catch(e){
    papersGrid.innerHTML='<div class="paper-meta">无法加载论文列表，请稍后重试。</div>'
  }
}

function render(list,cat){
  const filtered=cat==='全部'?list:list.filter(x=>x.category===cat);
  if(!filtered.length){papersGrid.innerHTML='<div class="paper-meta">该分类暂无论文</div>';return}
  papersGrid.innerHTML=filtered.map(p=>`
    <div class="paper-card">
      <h3>${p.title}</h3>
      <div class="paper-meta">${p.authors} · ${p.date}</div>
      <p style="margin-top:8px">${p.abstract}</p>
      <div style="margin-top:12px;display:flex;gap:8px">
        <a class="btn btn-primary" href="#" data-pdf="${p.pdf}" data-title="${p.title}">在线阅读</a>
        <a class="btn btn-outline" href="${p.pdf}" target="_blank" rel="noopener">下载 PDF</a>
      </div>
    </div>
  `).join('');
  papersGrid.querySelectorAll('a.btn-primary').forEach(a=>{
    a.addEventListener('click',e=>{e.preventDefault();openPdf(a.dataset.pdf,a.dataset.title)})
  })
}

function openPdf(url,title){
  currentPaperTitle.textContent=title||'';
  // Use Google Viewer as a fallback to avoid CORS if needed
  const viewerUrl=`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(url)}`;
  pdfFrame.src=viewerUrl;
}

loadPapers();
