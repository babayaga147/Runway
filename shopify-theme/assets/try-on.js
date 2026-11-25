/* Try it on: photo from the phone camera or a file, a garment overlay you drag, resize and rotate.
   Everything happens in the browser; the photo is never uploaded. */
(() => {
  'use strict';

  const root = document.querySelector('[data-try-on]');
  if (!root) return;

  const $ = (selector) => root.querySelector(selector);
  const video = $('[data-video]');
  const canvas = $('[data-canvas]');
  const ctx = canvas.getContext('2d');
  const hint = $('[data-hint]');
  const controls = $('[data-controls]');
  const snapButton = $('[data-snap]');
  const sizeInput = $('[data-size]');
  const rotateInput = $('[data-rotate]');
  const multiplyInput = $('[data-multiply]');
  const productLink = $('[data-product-link]');

  const MAX_SIDE = 1280;
  const state = { photo: null, garment: null, x: 0.5, y: 0.5, size: 0.6, rotate: 0, stream: null };

  const draw = () => {
    if (!state.photo) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.photo, 0, 0, canvas.width, canvas.height);
    const g = state.garment;
    if (!g) return;
    const width = canvas.width * state.size;
    const height = width * (g.naturalHeight / g.naturalWidth);
    ctx.save();
    ctx.translate(canvas.width * state.x, canvas.height * state.y);
    ctx.rotate((state.rotate * Math.PI) / 180);
    ctx.globalCompositeOperation = multiplyInput.checked ? 'multiply' : 'source-over';
    ctx.drawImage(g, -width / 2, -height / 2, width, height);
    ctx.restore();
  };

  const setPhoto = (source, width, height) => {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    state.photo = source;
    canvas.hidden = false;
    video.hidden = true;
    hint.hidden = true;
    snapButton.hidden = true;
    controls.hidden = false;
    draw();
  };

  const stopCamera = () => {
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  };

  $('[data-camera]').addEventListener('click', async () => {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (error) {
      hint.textContent = window.theme.strings.cameraDenied;
      hint.hidden = false;
      return;
    }
    video.srcObject = state.stream;
    await video.play();
    video.hidden = false;
    canvas.hidden = true;
    hint.hidden = true;
    snapButton.hidden = false;
  });

  snapButton.addEventListener('click', () => {
    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    frame.getContext('2d').drawImage(video, 0, 0);
    stopCamera();
    setPhoto(frame, frame.width, frame.height);
  });

  $('[data-file]').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    stopCamera();
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setPhoto(image, image.naturalWidth, image.naturalHeight);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

  root.querySelectorAll('[data-garment]').forEach((button) => {
    button.addEventListener('click', () => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        state.garment = image;
        state.x = 0.5;
        state.y = 0.5;
        root.querySelectorAll('[data-garment]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        productLink.href = button.dataset.url;
        productLink.hidden = false;
        draw();
      };
      image.src = button.dataset.garment;
    });
  });

  sizeInput.addEventListener('input', () => { state.size = sizeInput.value / 100; draw(); });
  rotateInput.addEventListener('input', () => { state.rotate = Number(rotateInput.value); draw(); });
  multiplyInput.addEventListener('change', draw);

  /* Drag the garment with one pointer; pinch with two to resize. */
  const pointers = new Map();
  let pinch = 0;
  const toCanvas = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height };
  };

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, event);
    pinch = 0;
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId) || !state.garment) return;
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, event);
    if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch) {
        state.size = Math.min(2, Math.max(0.1, state.size * (distance / pinch)));
        sizeInput.value = Math.round(state.size * 100);
      }
      pinch = distance;
    } else {
      const box = canvas.getBoundingClientRect();
      state.x += (event.clientX - previous.clientX) / box.width;
      state.y += (event.clientY - previous.clientY) / box.height;
    }
    draw();
  });
  const release = (event) => { pointers.delete(event.pointerId); pinch = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  $('[data-save]').addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'try-it-on.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  });

  window.addEventListener('pagehide', stopCamera);
})();
