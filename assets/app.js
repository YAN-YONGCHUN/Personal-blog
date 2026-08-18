// 移动端菜单
const hamburger = document.getElementById('hamburger');
const mobilemenu = document.getElementById('mobilemenu');
if (hamburger && mobilemenu) {
  hamburger.addEventListener('click', function () {
    mobilemenu.classList.toggle('open');
  });
  mobilemenu.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () {
      mobilemenu.classList.remove('open');
    });
  });
}

// 滚动淡入
(function () {
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { obs.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }
})();