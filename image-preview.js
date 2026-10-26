'use strict';

(() => {
  const preview = document.createElement('dialog');
  preview.className = 'hamie-image-preview';
  preview.setAttribute('aria-label', 'Ảnh phóng lớn. Bấm ra ngoài hoặc nhấn Escape để đóng.');
  preview.innerHTML = `
    <figure class="hamie-image-preview__figure">
      <img class="hamie-image-preview__image" alt="">
      <figcaption class="hamie-image-preview__caption"></figcaption>
    </figure>`;
  document.body.appendChild(preview);

  const enlargedImage = preview.querySelector('img');
  const caption = preview.querySelector('figcaption');
  let previousFocus;
  let previousOverflow;

  function isPreviewable(img) {
    return img instanceof HTMLImageElement &&
      !img.closest('.hamie-image-preview, #imageLightbox');
  }

  function openPreview(img) {
    if (preview.open || !img.naturalWidth) return;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    enlargedImage.src = img.currentSrc || img.src;
    enlargedImage.alt = img.alt || 'Hình ảnh HAMIE';
    caption.textContent = img.alt;
    caption.hidden = !img.alt;
    preview.showModal();
    document.body.style.overflow = 'hidden';
    enlargedImage.tabIndex = 0;
    enlargedImage.focus();
  }

  preview.addEventListener('click', event => {
    if (event.target === preview) preview.close();
  });
  preview.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    enlargedImage.removeAttribute('src');
  });

  // Capture image clicks before gallery/card handlers open another modal.
  document.addEventListener('click', event => {
    const image = event.target.closest('#viewImageBtn')
      ? document.getElementById('featuredImg')
      : event.target;
    if (!isPreviewable(image)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPreview(image);
  }, true);

  document.addEventListener('keydown', event => {
    if (preview.open) {
      // Keep existing page shortcuts from affecting content behind the dialog.
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        preview.close();
      }
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && isPreviewable(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPreview(event.target);
    }
  }, true);

  function prepareImages() {
    document.querySelectorAll('img').forEach(img => {
      if (!isPreviewable(img)) return;
      img.dataset.imagePreview = '';
      if (!img.closest('button, a')) {
        img.tabIndex = 0;
        img.setAttribute('role', 'button');
        img.setAttribute('aria-haspopup', 'dialog');
        img.setAttribute('aria-label', 'Phóng lớn ảnh: ' + (img.alt || 'HAMIE'));
      }
    });
  }

  prepareImages();
  // Article thumbnails and modal images are created dynamically.
  new MutationObserver(prepareImages).observe(document.body, { childList: true, subtree: true });
})();
