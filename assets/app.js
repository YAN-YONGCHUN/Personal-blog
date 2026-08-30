(function () {
  'use strict';

  const navToggle = document.querySelector('[data-nav-toggle]');
  const siteNav = document.getElementById('site-nav');
  const desktopNavigation = window.matchMedia('(min-width: 861px)');

  function navigationIsOpen() {
    return Boolean(navToggle && navToggle.getAttribute('aria-expanded') === 'true');
  }

  function closeNavigation(restoreFocus) {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', '打开导航菜单');
    siteNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    if (restoreFocus) navToggle.focus();
  }

  function openNavigation() {
    if (!navToggle || !siteNav) return;
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', '关闭导航菜单');
    siteNav.classList.add('is-open');
    document.body.classList.add('nav-open');

    const currentLink = siteNav.querySelector('[aria-current="page"]') || siteNav.querySelector('a');
    if (currentLink) window.requestAnimationFrame(function () { currentLink.focus(); });
  }

  if (navToggle && siteNav) {
    closeNavigation(false);

    navToggle.addEventListener('click', function () {
      if (navigationIsOpen()) closeNavigation(false);
      else openNavigation();
    });

    siteNav.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeNavigation(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && navigationIsOpen()) {
        closeNavigation(true);
        return;
      }

      if (event.key === 'Tab' && navigationIsOpen() && !desktopNavigation.matches) {
        const focusable = [navToggle].concat(Array.from(siteNav.querySelectorAll('a')));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    desktopNavigation.addEventListener('change', function (event) {
      if (event.matches) closeNavigation(false);
    });
  }

  document.querySelectorAll('[data-year]').forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });

  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  function selectTab(tab) {
    const tabList = tab.closest('[role="tablist"]');
    if (!tabList) return;

    tabList.querySelectorAll('[role="tab"]').forEach(function (item) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(item.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      selectTab(tab);
    });

    tab.addEventListener('keydown', function (event) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabList = tab.closest('[role="tablist"]');
      if (!tabList) return;
      const group = Array.from(tabList.querySelectorAll('[role="tab"]'));
      let index = group.indexOf(tab);
      if (event.key === 'ArrowRight') index = (index + 1) % group.length;
      if (event.key === 'ArrowLeft') index = (index - 1 + group.length) % group.length;
      if (event.key === 'Home') index = 0;
      if (event.key === 'End') index = group.length - 1;
      event.preventDefault();
      group[index].focus();
      selectTab(group[index]);
    });
  });

  document.querySelectorAll('[data-copy-code]').forEach(function (button) {
    const defaultLabel = button.textContent;
    button.setAttribute('aria-live', 'polite');

    button.addEventListener('click', async function () {
      const details = button.closest('.code-details');
      const code = details ? details.querySelector('code') : null;
      if (!code) return;

      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = '已复制';
      } catch (error) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection.removeAllRanges();
        selection.addRange(range);
        button.textContent = '已选中，请复制';
      }

      window.clearTimeout(Number(button.dataset.resetTimer || 0));
      const resetTimer = window.setTimeout(function () {
        button.textContent = defaultLabel;
      }, 1800);
      button.dataset.resetTimer = String(resetTimer);
    });
  });

  const copyEmailButton = document.querySelector('[data-copy-email]');
  if (copyEmailButton) {
    copyEmailButton.addEventListener('click', async function () {
      const email = copyEmailButton.dataset.email || '';
      const status = document.querySelector('[data-copy-status]');
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(email);
        } else {
          const helper = document.createElement('textarea');
          helper.value = email;
          helper.setAttribute('readonly', '');
          helper.className = 'clipboard-helper';
          document.body.appendChild(helper);
          helper.select();
          if (!document.execCommand('copy')) throw new Error('copy failed');
          helper.remove();
        }
        copyEmailButton.textContent = '已复制';
        if (status) status.textContent = '邮箱地址已复制到剪贴板。';
      } catch (error) {
        if (status) status.textContent = '无法自动复制，请长按或选中上方邮箱地址。';
      }

      window.setTimeout(function () {
        copyEmailButton.textContent = '复制邮箱';
      }, 1800);
    });
  }

  const retryButton = document.querySelector('[data-retry]');
  if (retryButton) {
    retryButton.addEventListener('click', function () {
      window.location.reload();
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {
        // The website remains fully usable when service workers are unavailable.
      });
    });
  }
})();
