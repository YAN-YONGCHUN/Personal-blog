(function () {
  'use strict';

  const topicFilter = document.getElementById('algorithm-topic-filter');
  const difficultyFilter = document.getElementById('algorithm-difficulty-filter');
  const searchInput = document.getElementById('algorithm-search');
  const grid = document.getElementById('leetcode-grid');
  const topicNav = document.querySelector('[data-topic-nav]');
  const count = document.querySelector('[data-algorithm-count]');
  const status = document.querySelector('[data-algorithm-status]');
  const empty = document.querySelector('[data-algorithm-empty]');

  if (!topicFilter || !difficultyFilter || !searchInput || !grid || !topicNav) return;

  let problems = [];
  let groups = [];

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function updateAddress() {
    const url = new URL(window.location.href);
    if (topicFilter.value === 'all') url.searchParams.delete('topic');
    else url.searchParams.set('topic', topicFilter.value);
    if (difficultyFilter.value === 'all') url.searchParams.delete('difficulty');
    else url.searchParams.set('difficulty', difficultyFilter.value);
    if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }

  function createTopicButton(value, title, total) {
    const button = makeElement('button', 'algorithm-topic-button', '');
    button.type = 'button';
    button.dataset.topic = value;
    button.setAttribute('aria-pressed', String(topicFilter.value === value));
    const name = makeElement('span', 'algorithm-topic-name', title);
    const amount = makeElement('span', 'algorithm-topic-count', String(total).padStart(2, '0'));
    button.append(name, amount);
    button.addEventListener('click', function () {
      topicFilter.value = value;
      applyFilters();
      updateAddress();
    });
    return button;
  }

  function renderTopicNav() {
    while (topicNav.firstChild) topicNav.removeChild(topicNav.firstChild);
    const all = makeElement('button', 'algorithm-topic-button', '');
    all.type = 'button';
    all.dataset.topic = 'all';
    all.setAttribute('aria-pressed', String(topicFilter.value === 'all'));
    all.append(makeElement('span', 'algorithm-topic-name', '全部题目'), makeElement('span', 'algorithm-topic-count', String(problems.length).padStart(3, '0')));
    all.addEventListener('click', function () {
      topicFilter.value = 'all';
      applyFilters();
      updateAddress();
    });
    topicNav.appendChild(all);
    groups.forEach(function (group) {
      const total = problems.filter(function (problem) { return problem.knowledgePoint === group.id; }).length;
      topicFilter.appendChild(makeElement('option', '', group.title));
      topicFilter.lastChild.value = group.id;
      topicNav.appendChild(createTopicButton(group.id, group.title, total));
    });
  }

  function createProblemCard(problem) {
    const card = makeElement('article', 'algorithm-problem-card');
    card.dataset.algorithmTopic = problem.knowledgePoint;

    const meta = makeElement('div', 'algorithm-problem-meta');
    meta.append(
      makeElement('span', 'algorithm-problem-number', `#${problem.number}`),
      makeElement('span', `algorithm-difficulty algorithm-difficulty-${problem.difficulty}`, problem.difficulty)
    );

    const title = makeElement('h3', '', problem.title);
    const detail = makeElement('p', 'algorithm-problem-detail', `${problem.knowledgePointTitle} · 通过率 ${problem.acceptanceRate}%`);
    const link = makeElement('a', 'text-link', '去力扣做题 →');
    link.href = problem.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `在力扣打开第 ${problem.number} 题 ${problem.title}`);

    card.append(meta, title, detail, link);
    return card;
  }

  function applyFilters() {
    const topic = topicFilter.value;
    const difficulty = difficultyFilter.value;
    const query = searchInput.value.trim().toLowerCase();
    const visible = problems.filter(function (problem) {
      const matchesTopic = topic === 'all' || problem.knowledgePoint === topic;
      const matchesDifficulty = difficulty === 'all' || problem.difficulty === difficulty;
      const haystack = `${problem.number} ${problem.title} ${problem.slug}`.toLowerCase();
      return matchesTopic && matchesDifficulty && (!query || haystack.includes(query));
    });

    Array.from(grid.children).forEach(function (card) {
      const number = card.querySelector('.algorithm-problem-number')?.textContent.slice(1);
      const match = visible.some(function (problem) { return problem.number === number; });
      card.hidden = !match;
    });
    topicNav.querySelectorAll('[data-topic]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.topic === topic));
    });
    if (count) count.textContent = `显示 ${visible.length} / ${problems.length} 道题`;
    if (empty) empty.hidden = visible.length !== 0;
  }

  function restoreFromAddress() {
    const params = new URLSearchParams(window.location.search);
    const topic = params.get('topic');
    const difficulty = params.get('difficulty');
    const query = params.get('q');
    if (topic && Array.from(topicFilter.options).some(function (option) { return option.value === topic; })) topicFilter.value = topic;
    if (difficulty && Array.from(difficultyFilter.options).some(function (option) { return option.value === difficulty; })) difficultyFilter.value = difficulty;
    if (query) searchInput.value = query;
  }

  topicFilter.addEventListener('change', function () { applyFilters(); updateAddress(); });
  difficultyFilter.addEventListener('change', function () { applyFilters(); updateAddress(); });
  searchInput.addEventListener('input', function () { applyFilters(); updateAddress(); });

  fetch('assets/leetcode-catalog.json')
    .then(function (response) {
      if (!response.ok) throw new Error('题库请求失败');
      return response.json();
    })
    .then(function (payload) {
      groups = Array.isArray(payload.groups) ? payload.groups : [];
      problems = Array.isArray(payload.problems) ? payload.problems : [];
      if (!groups.length || !problems.length) throw new Error('题库为空');
      renderTopicNav();
      restoreFromAddress();
      problems.forEach(function (problem) { grid.appendChild(createProblemCard(problem)); });
      applyFilters();
      if (status) status.textContent = `已加载 ${problems.length} 道力扣精选题，六类知识点各 20 道。`;
    })
    .catch(function () {
      if (count) count.textContent = '题库加载失败';
      if (status) status.textContent = '暂时无法读取题库，请稍后刷新重试。';
      if (empty) empty.hidden = false;
    });
})();
