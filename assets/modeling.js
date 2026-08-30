(function () {
  'use strict';

  const modelFilter = document.getElementById('model-filter');
  const modelCards = Array.from(document.querySelectorAll('[data-model-category]'));
  const modelCount = document.querySelector('[data-filter-count]');
  const paperFilter = document.getElementById('paper-filter');
  const paperGrid = document.getElementById('paper-grid');
  const paperCount = document.querySelector('[data-paper-count]');
  const paperStatus = document.querySelector('[data-paper-status]');

  function applyModelFilter() {
    if (!modelFilter || !modelCards.length) return;
    const category = modelFilter.value;
    let visible = 0;

    modelCards.forEach(function (card) {
      const match = category === '全部' || card.dataset.modelCategory === category;
      card.hidden = !match;
      if (match) visible += 1;
    });

    if (modelCount) modelCount.textContent = '当前显示 ' + visible + ' 个主题';
  }

  function updateModelAddress() {
    if (!modelFilter) return;
    const url = new URL(window.location.href);
    if (modelFilter.value === '全部') url.searchParams.delete('category');
    else url.searchParams.set('category', modelFilter.value);
    window.history.replaceState(null, '', url);
  }

  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function createPaperCard(paper) {
    const card = document.createElement('article');
    card.className = 'method-card paper-card';
    card.dataset.paperProblem = paper.problem;

    const index = document.createElement('span');
    index.className = 'card-index';
    index.textContent = paper.problem;

    const title = document.createElement('h3');
    title.textContent = paper.label;

    const description = document.createElement('p');
    description.textContent = '第 ' + paper.team + ' 队主论文 · PDF';

    const link = document.createElement('a');
    link.className = 'text-link';
    link.href = paper.file;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '打开 PDF →';

    card.append(index, title, description, link);
    return card;
  }

  function applyPaperFilter(cards) {
    if (!paperFilter) return;
    const problem = paperFilter.value;
    let visible = 0;

    cards.forEach(function (card) {
      const match = problem === '全部' || card.dataset.paperProblem === problem;
      card.hidden = !match;
      if (match) visible += 1;
    });

    if (paperCount) paperCount.textContent = '当前显示 ' + visible + ' 份论文';
  }

  function updatePaperAddress() {
    if (!paperFilter) return;
    const url = new URL(window.location.href);
    if (paperFilter.value === '全部') url.searchParams.delete('paper');
    else url.searchParams.set('paper', paperFilter.value);
    window.history.replaceState(null, '', url);
  }

  function loadPapers() {
    if (!paperFilter || !paperGrid) return;

    fetch('assets/papers.json')
      .then(function (response) {
        if (!response.ok) throw new Error('论文清单请求失败');
        return response.json();
      })
      .then(function (papers) {
        if (!Array.isArray(papers)) throw new Error('论文清单格式无效');
        const validPapers = papers.filter(function (paper) {
          return paper && paper.team && paper.problem && paper.label && paper.file;
        });
        clearNode(paperGrid);
        validPapers.forEach(function (paper) {
          paperGrid.appendChild(createPaperCard(paper));
        });
        const requested = new URLSearchParams(window.location.search).get('paper');
        if (requested && Array.from(paperFilter.options).some(function (option) { return option.value === requested; })) {
          paperFilter.value = requested;
        }
        const cards = Array.from(paperGrid.querySelectorAll('[data-paper-problem]'));
        applyPaperFilter(cards);
        if (paperStatus) paperStatus.textContent = '共收录 ' + validPapers.length + ' 份论文。';
      })
      .catch(function () {
        if (paperCount) paperCount.textContent = '论文清单加载失败';
        if (paperStatus) paperStatus.textContent = '暂时无法读取论文清单，请稍后重试。';
      });
  }

  if (modelFilter) {
    const requestedCategory = new URLSearchParams(window.location.search).get('category');
    if (requestedCategory && Array.from(modelFilter.options).some(function (option) { return option.value === requestedCategory; })) {
      modelFilter.value = requestedCategory;
    }
    modelFilter.addEventListener('change', function () {
      applyModelFilter();
      updateModelAddress();
    });
    applyModelFilter();
  }

  if (paperFilter) {
    paperFilter.addEventListener('change', function () {
      applyPaperFilter(Array.from(paperGrid.querySelectorAll('[data-paper-problem]')));
      updatePaperAddress();
    });
  }

  loadPapers();
})();
