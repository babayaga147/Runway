/* Theme behaviour: real Shopify cart helpers, toast, add-to-cart forms and cart page controls. */
(() => {
  'use strict';

  const { routes, strings } = window.theme;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const json = { 'Content-Type': 'application/json', Accept: 'application/json' };

  let toastTimer = 0;
  const toast = (message) => {
    const el = $('#bag-status');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), 2500);
  };

  const setCount = (count) => $$('[data-cart-count]').forEach((el) => { el.textContent = String(count); });

  const refresh = async () => {
    const response = await fetch(routes.cartJson, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('cart');
    const cart = await response.json();
    setCount(cart.item_count);
    return cart;
  };

  /* items: [{ id, quantity }]. A discount code, when given, is applied to the cart session. */
  const add = async (items, discountCode) => {
    const response = await fetch(routes.cartAdd, { method: 'POST', headers: json, body: JSON.stringify({ items }) });
    if (!response.ok) throw new Error('add');
    if (discountCode && items.length > 1) await fetch(`/discount/${encodeURIComponent(discountCode)}`).catch(() => {});
    await refresh();
    toast(items.length > 1 ? strings.addedLook : strings.addedPiece);
  };

  window.theme.cart = { add, refresh };
  window.theme.toast = toast;

  /* Product forms: add through AJAX, fall back to a normal form post if anything fails. */
  $$('[data-product-form]').forEach((form) => {
    const button = $('[data-add]', form);
    const label = button.textContent;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = Number(new FormData(form).get('id'));
      if (!id) { toast(strings.chooseSize); return; }
      try {
        await add([{ id, quantity: 1 }]);
      } catch (error) {
        form.submit();
        return;
      }
      button.textContent = button.dataset.added;
      const link = $('[data-bag-link]', form);
      if (link) link.hidden = false;
      setTimeout(() => { button.textContent = label; }, 1800);
    });
  });

  /* Variant pills: keep the hidden variant id in step with the chosen options. */
  $$('[data-variant-picker]').forEach((picker) => {
    const variants = JSON.parse($('[data-variants]', picker).textContent);
    const form = picker.closest('form');
    const idInput = $('input[name="id"]', form);
    const button = $('[data-add]', form);
    const sync = () => {
      const chosen = $$('input[type="radio"]:checked', picker).map((input) => input.value);
      const variant = variants.find((v) => v.options.every((value, i) => value === chosen[i]));
      idInput.value = variant && variant.available ? variant.id : '';
      button.disabled = !(variant && variant.available);
      button.textContent = variant && !variant.available ? strings.unavailable : button.dataset.add;
    };
    picker.addEventListener('change', sync);
    sync();
  });

  /* Cart page: quantity changes post to /cart/change and reload the section. */
  $$('[data-cart-line]').forEach((row) => {
    const line = row.dataset.cartLine;
    const change = async (quantity) => {
      await fetch(routes.cartChange, { method: 'POST', headers: json, body: JSON.stringify({ line, quantity }) });
      location.reload();
    };
    $$('[data-qty]', row).forEach((button) => button.addEventListener('click', () => change(Number(button.dataset.qty))));
  });
})();
