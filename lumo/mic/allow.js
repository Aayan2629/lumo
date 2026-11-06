// "Allow microphone" tab. Approving here grants the mic to Lumo's own pages, which includes the hidden
// frame that listens on listing pages (mic/mic.html).
const msg = document.getElementById('msg');
const btn = document.getElementById('allow');

function done() {
  msg.className = 'ok';
  msg.textContent = 'Done. You can close this tab and use ⌥1 / ⌥2 on any listing.';
  btn.hidden = true;
  chrome.storage.local.set({ micGranted: true });
}

btn.onclick = async () => {
  msg.className = ''; msg.textContent = '';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    done();
  } catch (e) {
    chrome.storage.local.remove('micGranted');
    msg.className = 'bad';
    msg.textContent = e && e.name === 'NotFoundError'
      ? 'No microphone found. Plug one in and try again.'
      : 'The microphone is blocked for Lumo. Click the icon at the right of the address bar (or open chrome://settings/content/microphone), set Lumo to Allow, then reload this tab.';
  }
};

// Already allowed (for example after reinstalling): say so straight away.
navigator.permissions?.query({ name: 'microphone' }).then((p) => { if (p.state === 'granted') done(); }).catch(() => {});
