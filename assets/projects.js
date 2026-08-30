(function () {
  'use strict';

  const categoryFilter = document.getElementById('project-category-filter');
  const searchInput = document.getElementById('project-search');
  const grid = document.querySelector('[data-project-grid]');
  const categoryNav = document.querySelector('[data-project-category-nav]');
  const count = document.querySelector('[data-project-count]');
  const empty = document.querySelector('[data-project-empty]');
  const updated = document.querySelector('[data-project-updated]');

  if (!categoryFilter || !searchInput || !grid || !categoryNav || !count || !empty) return;

  let projects = [];

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatStars(value) {
    return Number(value).toLocaleString('en-US');
  }

  function normalized(value) {
    return String(value || '').toLocaleLowerCase('zh-CN');
  }

  function updateAddress() {
    const url = new URL(window.location.href);
    if (categoryFilter.value === 'all') url.searchParams.delete('category');
    else url.searchParams.set('category', categoryFilter.value);
    if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
  }

  function createCategoryButton(value, label, total) {
    const button = makeElement('button', 'project-category-button');
    button.type = 'button';
    button.dataset.category = value;
    button.setAttribute('aria-pressed', String(categoryFilter.value === value));
    button.append(makeElement('span', 'project-category-label', label), makeElement('span', 'project-category-total', String(total).padStart(2, '0')));
    button.addEventListener('click', function () {
      categoryFilter.value = value;
      applyFilters();
      updateAddress();
    });
    return button;
  }

  function renderCategoryNav() {
    while (categoryNav.firstChild) categoryNav.removeChild(categoryNav.firstChild);
    const categories = [
      { id: 'all', label: '全部项目' },
      { id: 'software', label: '通用软件' },
      { id: 'stm32', label: 'STM32 / Cortex-M' },
      { id: 'raspberry', label: 'Raspberry Pi' }
    ];
    categories.forEach(function (category) {
      const total = category.id === 'all' ? projects.length : projects.filter(function (project) { return project.category === category.id; }).length;
      categoryNav.appendChild(createCategoryButton(category.id, category.label, total));
    });
  }

  function createProjectCard(project) {
    const card = makeElement('article', 'project-library-card reveal');
    card.dataset.projectCategory = project.category;

    const header = makeElement('header', 'project-library-card-head');
    header.append(makeElement('span', 'project-library-category', project.categoryLabel), makeElement('span', 'project-library-stars', `★ ${formatStars(project.stars)}`));
    const title = makeElement('h3', '', project.name);
    const summary = makeElement('p', 'project-library-summary', project.summary);
    header.append(title, summary);

    const meta = makeElement('dl', 'project-library-meta');
    [["技术栈", project.technology], ["语言", project.language], ["许可证", project.license]].forEach(function (item) {
      const row = makeElement('div');
      row.append(makeElement('dt', '', item[0]), makeElement('dd', '', item[1]));
      meta.appendChild(row);
    });

    const footer = makeElement('footer', 'project-library-card-foot');
    const branch = makeElement('span', 'project-library-branch', `分支 ${project.branch}`);
    const links = makeElement('div', 'project-library-links');
    const sourceLink = makeElement('a', 'text-link', '查看仓库');
    sourceLink.href = project.repository;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    const readmeLink = makeElement('a', 'text-link', 'README');
    readmeLink.href = project.readme;
    readmeLink.target = '_blank';
    readmeLink.rel = 'noopener noreferrer';
    links.append(sourceLink, readmeLink);
    footer.append(branch, links);

    card.append(header, meta, footer);
    return card;
  }

  function applyFilters() {
    const category = categoryFilter.value;
    const query = normalized(searchInput.value.trim());
    const visible = projects.filter(function (project) {
      const inCategory = category === 'all' || project.category === category;
      const haystack = normalized([project.name, project.summary, project.technology, project.language, project.license].join(' '));
      return inCategory && (!query || haystack.includes(query));
    });

    while (grid.firstChild) grid.removeChild(grid.firstChild);
    visible.forEach(function (project) { grid.appendChild(createProjectCard(project)); });
    count.textContent = String(visible.length);
    empty.hidden = visible.length > 0;
    categoryNav.querySelectorAll('[data-category]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.category === category));
    });
  }

  function readAddress() {
    const params = new URL(window.location.href).searchParams;
    const category = params.get('category');
    if (category && Array.from(categoryFilter.options).some(function (option) { return option.value === category; })) categoryFilter.value = category;
    searchInput.value = params.get('q') || '';
  }

  categoryFilter.addEventListener('change', function () { applyFilters(); updateAddress(); });
  searchInput.addEventListener('input', function () { applyFilters(); updateAddress(); });

  fetch('assets/github-projects.json')
    .then(function (response) {
      if (!response.ok) throw new Error(`Project catalog request failed: ${response.status}`);
      return response.json();
    })
    .then(function (catalog) {
      projects = Array.isArray(catalog.projects) ? catalog.projects : [];
      if (updated && catalog.updatedAt) {
        updated.textContent = catalog.updatedAt;
        updated.dateTime = catalog.updatedAt;
      }
      readAddress();
      renderCategoryNav();
      applyFilters();
    })
    .catch(function (error) {
      grid.replaceChildren(makeElement('p', 'project-library-error', '项目目录暂时无法加载，请稍后刷新。'));
      empty.hidden = true;
      console.error(error);
    });
}());
