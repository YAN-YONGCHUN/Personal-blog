(function () {
  'use strict';

  const filter = document.getElementById('model-filter');
  const cards = Array.from(document.querySelectorAll('[data-model-category]'));
  const count = document.querySelector('[data-filter-count]');

  if (!filter || !cards.length) return;

  function applyFilter() {
    const category = filter.value;
    let visible = 0;

    cards.forEach(function (card) {
      const match = category === '全部' || card.dataset.modelCategory === category;
      card.hidden = !match;
      if (match) visible += 1;
    });

    if (count) count.textContent = '当前显示 ' + visible + ' 个主题';
  }

  function updateAddress() {
    const url = new URL(window.location.href);
    if (filter.value === '全部') url.searchParams.delete('category');
    else url.searchParams.set('category', filter.value);
    window.history.replaceState(null, '', url);
  }

  const requested = new URLSearchParams(window.location.search).get('category');
  if (requested && Array.from(filter.options).some(function (option) { return option.value === requested; })) {
    filter.value = requested;
  }

  filter.addEventListener('change', function () {
    applyFilter();
    updateAddress();
  });
  applyFilter();
})();
