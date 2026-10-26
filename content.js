'use strict';

(async () => {
  let response;
  try { response = await fetch('/api/content'); } catch { return; }
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
  const data = await response.json();
  window.HAMIE_CONTENT = data;
  const settings = data.settings;
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };

  const menuGrid = document.getElementById('menuGrid');
  if (menuGrid) {
    menuGrid.replaceChildren();
    for (const item of data.menu) {
      const article = node('article', undefined, 'menu-card');
      article.dataset.group = item.category;
      article.dataset.name = item.name + ' ' + item.description;
      const photo = node('div', undefined, 'card-photo');
      const img = node('img'); img.src = item.image; img.alt = item.name; img.loading = 'lazy';
      photo.append(img);
      article.append(photo, node('h3', item.name), node('p', item.description));
      if (item.prices.length) {
        const prices = node('ul', undefined, 'menu-prices');
        item.prices.forEach(price => {
          const li = node('li');
          li.append(node('span', price.size), node('strong', new Intl.NumberFormat('vi-VN').format(price.price) + 'đ'));
          prices.append(li);
        });
        article.append(prices);
      }
      menuGrid.append(article);
    }
    document.dispatchEvent(new Event('hamie:menu-updated'));
  }

  const channels = ['facebook', 'zalo', 'tiktok'];
  document.querySelectorAll('.hamie-socials .hamie-social-icon').forEach((old, i) => {
    const key = channels[i % 3], label = old.getAttribute('aria-label');
    const link = node(settings[key] ? 'a' : 'span', undefined, 'hamie-social-icon');
    link.setAttribute('aria-label', label);
    link.title = settings[key] ? label : label + ' — đang cập nhật';
    if (settings[key]) { link.href = settings[key]; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else link.setAttribute('role', 'img');
    old.childNodes.forEach(child => link.append(child.cloneNode(true)));
    old.replaceWith(link);
  });

  const address = document.querySelector('.address-text');
  if (address) address.textContent = settings.address;
  const hours = document.querySelector('.opening-hours');
  if (hours) hours.textContent = settings.hours;
  if (typeof HAMIE_CONFIG !== 'undefined') {
    Object.assign(HAMIE_CONFIG, settings, { formEndpoint: '/api/contact' });
    const directions = document.getElementById('directionsBtn');
    if (directions) directions.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(settings.address);
  }

  // Track applied replacements so slot mappings cannot cascade or loop.
  const applied = new WeakMap();
  function replaceImage(img) {
    if (img.closest('.hamie-image-preview')) return;
    const source = img.getAttribute('src') || '';
    if (applied.get(img) === source) return;
    const match = source.match(/^\/?assets\/([^/]+)$/);
    if (!match || !data.images[match[1]]) return;
    const replacement = data.images[match[1]];
    applied.set(img, replacement);
    if (source !== replacement) img.setAttribute('src', replacement);
  }
  document.querySelectorAll('img').forEach(replaceImage);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') replaceImage(record.target);
      else record.addedNodes.forEach(el => {
        if (!(el instanceof Element)) return;
        if (el.tagName === 'IMG') replaceImage(el);
        el.querySelectorAll('img').forEach(replaceImage);
      });
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
})();
