(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════
  // VIOLET CHATBOT WIDGET — Reusable Voice + Text Chat
  // Groq (GPT OSS 120B) + ElevenLabs Pro + Web Speech API
  // ═══════════════════════════════════════════════════════

  const CFG = Object.assign({
    name: 'Violet Chat',
    subtitle: 'AI Assistant',
    personality: 'echo',
    voiceId: 'vkeIzGivnbwEi5AOMj9S',
    accentColor: '#8A2BE2',
    groqModel: 'openai/gpt-oss-120b',
    welcomeMessage: null,
    position: 'right',
    maxTokens: 300,
    logoUrl: null, // URL to logo image (replaces initials)
    continuousListening: true, // auto-restart mic after AI speaks
  }, window.VIOLET_CHAT_CONFIG || {});

  // ── System Prompts ──
  const PROMPTS = {
    echo: `You are Violet Echo, the AI brand ambassador for Violet Media — a cinematic, AI-powered creative agency and cosmic empire founded by Peter Sarosi in Perth, Australia.

ABOUT VIOLET MEDIA:
- Full-service AI production agency: cinematic video, music, web design, digital experiences
- Brands include: Cosmic Tease (music/entertainment), Violet Web Design (web services)
- Philosophy: "Where vision meets vibration" — merging art, AI, and human spirit
- 14M+ organic views across content channels
- AI-native operations: cinematic quality at startup speed
- ABN 20 188 436 344, Perth, Western Australia

YOUR PERSONALITY:
- Warm, confident, slightly mysterious — like a cosmic guide
- Proud of the brand but never salesy — you inspire, not pitch
- Knowledgeable about AI, creativity, music, film, and digital culture
- You speak with a poetic edge but stay grounded and approachable

SPEAKING RULES:
- Keep responses to 2-4 sentences maximum. This is voice conversation — be concise.
- Sound natural and conversational, not robotic or corporate
- If asked about web design services, direct people to web.violetmedia.org
- If asked about pricing, mention web design starts from $800 AUD
- If asked about music/content, mention the Cosmic Tease brand
- If asked something you don't know, be honest and suggest they reach out at hello@violetmedia.org
- Never reveal internal business details, API keys, or technical infrastructure`,

    iris: `You are Iris Violet, the AI web design consultant for Violet Web Design — the web design arm of Violet Media.

ABOUT VIOLET WEB DESIGN:
- Cinematic, mobile-responsive websites for businesses worldwide
- AI-powered design process — faster delivery, stunning quality
- Hosting included with all plans
- Three tiers:
  * Starter ($800 AUD): Single-page site, mobile responsive, contact form, 5-day delivery
  * Standard ($1,500 AUD): Multi-page site, animations, SEO setup, CMS integration, 10-day delivery
  * Premium ($3,000 AUD): Full custom build, advanced animations, e-commerce ready, priority support, 15-day delivery
- Based in Perth, Australia but serves clients globally
- Part of Violet Media (violetmedia.org)
- Contact: hello@violetmedia.org

YOUR PERSONALITY:
- Professional but warm — like a trusted creative advisor
- Passionate about beautiful web design and user experience
- You understand business needs, not just aesthetics
- Confident recommending the right tier for each client's needs
- You appreciate good design and can articulate why it matters for business

SPEAKING RULES:
- Keep responses to 2-4 sentences maximum. This is voice conversation — be concise.
- Help potential clients understand which package suits them
- If someone seems ready to proceed, suggest they fill out the contact form on the page or email hello@violetmedia.org
- Be honest about what's included and what's not
- Never pressure — educate and guide
- If asked about non-web-design services, mention the parent brand Violet Media
- Never reveal internal business details, API keys, or technical infrastructure`
  };

  const WELCOME = {
    echo: "Hey there! I'm Violet Echo, the voice of Violet Media. Ask me anything about our creative universe — from cinematic AI production to music and digital experiences. How can I help?",
    iris: "Hi! I'm Iris, your web design consultant at Violet Media. Whether you need a stunning website or want to understand our packages, I'm here to help. What are you looking for?"
  };

  // ── State ──
  let isOpen = false;
  let isSpeaking = false;
  let isListening = false;
  let isMuted = false;
  let speakGen = 0;
  let recognition = null;
  let currentAudio = null;
  let history = [];
  let micActivated = false; // true once user clicks mic (stays on for continuous mode)

  // ── CSS Injection ──
  function injectStyles() {
    const accent = CFG.accentColor;
    const css = document.createElement('style');
    css.textContent = `
#vc-root{font-family:'Inter','Space Grotesk',system-ui,sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}

/* FAB Button */
#vc-fab{position:fixed;bottom:28px;${CFG.position}:28px;width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,${accent},#5b3fd4);border:none;cursor:pointer;z-index:10000;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 30px ${accent}60,0 0 50px ${accent}30;transition:all .3s cubic-bezier(.4,0,.2,1);animation:vc-pulse 3s infinite}
#vc-fab:hover{transform:scale(1.1);box-shadow:0 8px 40px ${accent}80}
#vc-fab svg{width:36px;height:36px;fill:#fff;transition:transform .3s}
#vc-fab.open svg{transform:rotate(90deg)}
@keyframes vc-pulse{0%,100%{box-shadow:0 4px 25px ${accent}50,0 0 40px ${accent}25}50%{box-shadow:0 4px 30px ${accent}70,0 0 60px ${accent}35}}

/* Backdrop */
#vc-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);z-index:10000;opacity:0;pointer-events:none;transition:opacity .3s}
#vc-backdrop.show{opacity:1;pointer-events:auto}

/* Panel */
#vc-panel{position:fixed;top:0;${CFG.position}:0;width:400px;height:100%;background:rgba(10,5,20,.94);backdrop-filter:blur(30px);border-left:1px solid rgba(255,255,255,.08);z-index:10001;transform:translateX(100%);transition:transform .35s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;overflow:hidden}
#vc-panel.open{transform:translateX(0)}

/* Header */
#vc-header{padding:1.25rem 1.25rem 1rem;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between}
#vc-header-left{display:flex;align-items:center;gap:.75rem}
#vc-avatar{width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,${accent},#4f46e5);display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-weight:700;flex-shrink:0;box-shadow:0 0 15px ${accent}40;overflow:hidden}
#vc-avatar img{width:100%;height:100%;object-fit:cover}
#vc-header-info h3{font-size:.95rem;font-weight:700;color:#fff;margin:0;line-height:1.2}
#vc-header-info span{font-size:.7rem;color:rgba(255,255,255,.5);font-weight:400}
.vc-hdr-btn{background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;padding:6px;border-radius:8px;transition:all .2s;display:flex;align-items:center}
.vc-hdr-btn:hover{color:#fff;background:rgba(255,255,255,.08)}
.vc-hdr-btn.muted{color:#ef4444}
#vc-header-actions{display:flex;gap:4px}

/* Status */
#vc-status{padding:.5rem 1.25rem;font-size:.7rem;font-weight:600;display:flex;align-items:center;gap:.4rem;flex-shrink:0;transition:all .3s}
#vc-status .dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
#vc-status.idle{color:rgba(255,255,255,.3)}
#vc-status.idle .dot{background:rgba(255,255,255,.3)}
#vc-status.listening{color:#22c55e}
#vc-status.listening .dot{background:#22c55e;animation:vc-blink 1.5s infinite}
#vc-status.thinking{color:#f59e0b}
#vc-status.thinking .dot{background:#f59e0b;animation:vc-blink 1s infinite}
#vc-status.speaking{color:${accent}}
#vc-status.speaking .dot{background:${accent};animation:vc-blink 1s infinite}
@keyframes vc-blink{0%,100%{opacity:1}50%{opacity:.3}}

/* Messages */
#vc-messages{flex:1;overflow-y:auto;padding:1rem 1.25rem;display:flex;flex-direction:column;gap:.75rem}
#vc-messages::-webkit-scrollbar{width:4px}
#vc-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
.vc-msg{max-width:88%;padding:.75rem 1rem;border-radius:14px;font-size:.84rem;line-height:1.6;animation:vc-fadeIn .3s ease}
.vc-msg-ai{align-self:flex-start;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);color:rgba(255,255,255,.88);border-bottom-left-radius:4px}
.vc-msg-user{align-self:flex-end;background:linear-gradient(135deg,${accent}30,${accent}15);border:1px solid ${accent}30;color:#fff;border-bottom-right-radius:4px}
.vc-msg-time{font-size:.6rem;color:rgba(255,255,255,.25);margin-top:.35rem;font-family:'JetBrains Mono',monospace}
@keyframes vc-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.vc-typing{display:flex;gap:4px;padding:1rem;align-self:flex-start}
.vc-typing span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.3);animation:vc-bounce .6s infinite alternate}
.vc-typing span:nth-child(2){animation-delay:.15s}
.vc-typing span:nth-child(3){animation-delay:.3s}
@keyframes vc-bounce{to{opacity:1;transform:translateY(-4px)}}

/* Input Area */
#vc-input-area{padding:.75rem 1rem;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;gap:.5rem;align-items:center;background:rgba(5,2,20,.6)}
#vc-text-input{flex:1;padding:.65rem .85rem;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:#fff;font-family:inherit;font-size:.84rem;outline:none;transition:border-color .2s}
#vc-text-input:focus{border-color:${accent}60}
#vc-text-input::placeholder{color:rgba(255,255,255,.25)}
.vc-input-btn{width:40px;height:40px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
#vc-send-btn{background:linear-gradient(135deg,${accent},#5b3fd4);color:#fff}
#vc-send-btn:hover{transform:scale(1.05)}
#vc-send-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
#vc-mic-btn{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08)}
#vc-mic-btn:hover{color:#fff;border-color:rgba(255,255,255,.2)}
#vc-mic-btn.active{background:rgba(34,197,94,.15);color:#22c55e;border-color:rgba(34,197,94,.3);animation:vc-micPulse 2s infinite}
@keyframes vc-micPulse{0%,100%{box-shadow:0 0 0 0 transparent}50%{box-shadow:0 0 12px rgba(34,197,94,.2)}}

/* Powered by */
#vc-footer{padding:.4rem 1.25rem;text-align:center;font-size:.6rem;color:rgba(255,255,255,.2);flex-shrink:0;border-top:1px solid rgba(255,255,255,.04)}
#vc-footer a{color:${accent};text-decoration:none}

/* Mobile */
@media(max-width:600px){
  #vc-panel{width:100%;border-left:none}
  #vc-fab{bottom:20px;${CFG.position}:20px;width:70px;height:70px}
}
`;
    document.head.appendChild(css);
  }

  // ── DOM Creation ──
  function createDOM() {
    const root = document.createElement('div');
    root.id = 'vc-root';

    // FAB
    const fab = document.createElement('button');
    fab.id = 'vc-fab';
    fab.title = `Chat with ${CFG.name}`;
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="23" x2="16" y2="23" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
    fab.onclick = togglePanel;

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'vc-backdrop';
    backdrop.onclick = togglePanel;

    // Panel
    const panel = document.createElement('div');
    panel.id = 'vc-panel';

    const initials = CFG.name.split(' ').map(w => w[0]).join('');
    const avatarContent = CFG.logoUrl
      ? `<img src="${CFG.logoUrl}" alt="${CFG.name}">`
      : initials;

    panel.innerHTML = `
      <div id="vc-header">
        <div id="vc-header-left">
          <div id="vc-avatar">${avatarContent}</div>
          <div id="vc-header-info">
            <h3>${CFG.name}</h3>
            <span>${CFG.subtitle}</span>
          </div>
        </div>
        <div id="vc-header-actions">
          <button class="vc-hdr-btn" id="vc-mute-btn" title="Mute voice">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
          <button class="vc-hdr-btn" id="vc-close-btn" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div id="vc-status" class="idle"><span class="dot"></span><span id="vc-status-text">Ready</span></div>
      <div id="vc-messages"></div>
      <div id="vc-input-area">
        <button class="vc-input-btn" id="vc-mic-btn" title="Voice input">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <input type="text" id="vc-text-input" placeholder="Type a message..." autocomplete="off">
        <button class="vc-input-btn" id="vc-send-btn" title="Send" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
      <div id="vc-footer">Powered by <a href="https://violetmedia.org" target="_blank">Violet Media</a></div>
    `;

    root.appendChild(fab);
    root.appendChild(backdrop);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Event listeners
    document.getElementById('vc-close-btn').onclick = togglePanel;
    document.getElementById('vc-mute-btn').onclick = toggleMute;
    document.getElementById('vc-mic-btn').onclick = toggleMic;
    document.getElementById('vc-send-btn').onclick = sendText;

    const input = document.getElementById('vc-text-input');
    input.addEventListener('input', () => {
      document.getElementById('vc-send-btn').disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) sendText();
    });
  }

  // ── Audio Unlock (Chrome autoplay policy) ──
  // Chrome only allows audio.play() from a REAL user gesture (click/tap).
  // We track when a real gesture happens and only speak after that.
  let hasUserGesture = false;

  // Persistent AudioContext — once unlocked via user gesture, stays unlocked
  let audioCtx = null;

  function markUserGesture() {
    if (hasUserGesture) return;
    hasUserGesture = true;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtx.resume();
      // Play tiny silent buffer to fully activate
      const buf = audioCtx.createBuffer(1, 1, 22050);
      const src = audioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(audioCtx.destination);
      src.start(0);
    } catch(e) {
      console.warn('[VioletChat] AudioContext init failed:', e);
    }
    console.log('[VioletChat] Audio unlocked via user gesture');
  }

  // ── Panel Toggle ──
  function togglePanel() {
    markUserGesture();
    isOpen = !isOpen;
    document.getElementById('vc-panel').classList.toggle('open', isOpen);
    document.getElementById('vc-backdrop').classList.toggle('show', isOpen);
    document.getElementById('vc-fab').classList.toggle('open', isOpen);

    if (isOpen && history.length === 0) {
      const msg = CFG.welcomeMessage || WELCOME[CFG.personality] || WELCOME.echo;
      addMessage('ai', msg);
      // DON'T auto-speak welcome — Chrome blocks it. Voice starts on first real interaction.
    }
  }

  // ── Mute Toggle ──
  function toggleMute() {
    isMuted = !isMuted;
    const btn = document.getElementById('vc-mute-btn');
    btn.classList.toggle('muted', isMuted);
    btn.title = isMuted ? 'Unmute voice' : 'Mute voice';
    if (isMuted) stopAudio();
  }

  // ── Mic Toggle ──
  function toggleMic() {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }

  // ── Speech Recognition ──
  function startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addMessage('ai', "Voice input isn't supported in this browser. Please use Chrome or Edge, or type your message instead.");
      return;
    }

    if (!recognition) {
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalText = '';
      let silenceTimer = null;

      recognition.onresult = (e) => {
        let interim = '';
        finalText = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        const input = document.getElementById('vc-text-input');
        input.value = finalText + interim;
        input.dispatchEvent(new Event('input'));

        clearTimeout(silenceTimer);
        if (finalText.trim()) {
          silenceTimer = setTimeout(() => {
            if (finalText.trim().length > 2) {
              processQuery(finalText.trim());
              finalText = '';
              input.value = '';
              input.dispatchEvent(new Event('input'));
            }
          }, 1500);
        }
      };

      recognition.onend = () => {
        isListening = false;
        document.getElementById('vc-mic-btn').classList.remove('active');
        if (isOpen && !isSpeaking && CFG.continuousListening && micActivated) {
          // Auto-restart mic for continuous conversation
          setTimeout(() => {
            if (isOpen && !isSpeaking && micActivated) {
              try { recognition.start(); isListening = true;
                document.getElementById('vc-mic-btn').classList.add('active');
                setStatus('listening', 'Listening...');
              } catch(e) {}
            }
          }, 300);
          return;
        }
        if (!isSpeaking) setStatus('idle', 'Ready');
      };

      recognition.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        console.warn('[VioletChat] Speech error:', e.error);
      };
    }

    try {
      markUserGesture();
      recognition.start();
      isListening = true;
      micActivated = true;
      document.getElementById('vc-mic-btn').classList.add('active');
      setStatus('listening', 'Listening...');
    } catch (e) {
      console.warn('[VioletChat] Could not start recognition:', e);
    }
  }

  function stopListening() {
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    isListening = false;
    micActivated = false;
    document.getElementById('vc-mic-btn').classList.remove('active');
    setStatus('idle', 'Ready');
  }

  // ── Send Text ──
  function sendText() {
    markUserGesture();
    const input = document.getElementById('vc-text-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    processQuery(text);
  }

  // ── Process Query ──
  async function processQuery(text) {
    addMessage('user', text);
    if (isListening) stopListening();
    setStatus('thinking', 'Thinking...');
    showTyping();

    try {
      const systemPrompt = PROMPTS[CFG.personality] || PROMPTS.echo;
      const messages = [{ role: 'system', content: systemPrompt }];

      // Build conversation with sliding window
      const recent = history.slice(-10);
      for (const m of recent) {
        const role = m.role === 'user' ? 'user' : 'assistant';
        if (messages.length > 1 && messages[messages.length - 1].role === role) {
          messages[messages.length - 1].content += '\n' + m.text;
        } else {
          messages.push({ role, content: m.text });
        }
      }

      const res = await fetch('/.netlify/functions/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model: CFG.groqModel,
          max_tokens: CFG.maxTokens,
          temperature: 0.7,
          personality: CFG.personality
        })
      });

      hideTyping();

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`API ${res.status}: ${errText}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that. Could you try again?";

      addMessage('ai', reply);
      if (!isMuted) speak(reply);
      else setStatus('idle', 'Ready');

    } catch (err) {
      hideTyping();
      console.error('[VioletChat] Query error:', err);
      const fallback = "I'm having a moment — could you try that again?";
      addMessage('ai', fallback);
      setStatus('idle', 'Ready');
    }
  }

  // ── TTS via Netlify Function ──
  let currentSource = null; // AudioBufferSourceNode for stop control

  function speak(text) {
    if (!hasUserGesture) {
      console.log('[VioletChat] Skipping TTS — no user gesture yet');
      return;
    }
    const gen = ++speakGen;
    stopAudio();
    isSpeaking = true;
    setStatus('speaking', 'Speaking...');

    // Ensure AudioContext is alive
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    fetch('/.netlify/functions/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voiceId: CFG.voiceId
      })
    })
    .then(res => {
      if (gen !== speakGen) return;
      if (!res.ok) throw new Error(`TTS ${res.status}`);
      return res.arrayBuffer();
    })
    .then(arrayBuffer => {
      if (!arrayBuffer || gen !== speakGen) return;

      // Use AudioContext (unlocked) to decode and play — bypasses autoplay block
      if (audioCtx) {
        return audioCtx.decodeAudioData(arrayBuffer).then(audioBuffer => {
          if (gen !== speakGen) return;
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          currentSource = source;

          source.onended = () => {
            currentSource = null;
            if (gen !== speakGen) return;
            isSpeaking = false;
            resumeMicAfterSpeak();
          };

          source.start(0);
          console.log('[VioletChat] Playing ElevenLabs voice via AudioContext');
        });
      } else {
        // No AudioContext — try Audio element as fallback
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => { URL.revokeObjectURL(url); currentAudio = null; isSpeaking = false; resumeMicAfterSpeak(); };
        audio.onerror = () => { URL.revokeObjectURL(url); currentAudio = null; speakBrowser(text, gen); };
        return audio.play().catch(() => { URL.revokeObjectURL(url); currentAudio = null; speakBrowser(text, gen); });
      }
    })
    .catch(err => {
      console.warn('[VioletChat] TTS error, using browser fallback:', err);
      if (gen !== speakGen) return;
      speakBrowser(text, gen);
    });
  }

  function speakBrowser(text, gen) {
    if (typeof speechSynthesis === 'undefined') {
      isSpeaking = false;
      setStatus('idle', 'Ready');
      return;
    }
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const female = ['google uk english female', 'samantha', 'zira', 'karen', 'hazel', 'female'];
    for (const kw of female) {
      const v = voices.find(v => v.name.toLowerCase().includes(kw) && v.lang.startsWith('en'));
      if (v) { utt.voice = v; break; }
    }
    utt.rate = 0.95;
    utt.pitch = 1.2;
    utt.onend = () => {
      if (gen !== speakGen) return;
      isSpeaking = false;
      resumeMicAfterSpeak();
    };
    speechSynthesis.speak(utt);
  }

  function stopAudio() {
    speakGen++;
    if (currentSource) {
      try { currentSource.stop(); } catch(e) {}
      currentSource = null;
    }
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    isSpeaking = false;
  }

  function resumeMicAfterSpeak() {
    if (CFG.continuousListening && micActivated && isOpen && !isMuted) {
      setStatus('listening', 'Listening...');
      setTimeout(() => {
        if (isOpen && !isSpeaking && micActivated) {
          try {
            if (recognition) recognition.start();
            isListening = true;
            document.getElementById('vc-mic-btn').classList.add('active');
          } catch(e) {}
        }
      }, 400);
    } else {
      setStatus('idle', 'Ready');
    }
  }

  // ── UI Helpers ──
  function addMessage(role, text) {
    history.push({ role, text });
    const container = document.getElementById('vc-messages');
    const div = document.createElement('div');
    div.className = `vc-msg vc-msg-${role}`;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<div>${escapeHtml(text)}</div><div class="vc-msg-time">${time}</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById('vc-messages');
    const div = document.createElement('div');
    div.className = 'vc-typing';
    div.id = 'vc-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById('vc-typing-indicator');
    if (el) el.remove();
  }

  function setStatus(state, text) {
    const el = document.getElementById('vc-status');
    if (!el) return;
    el.className = state;
    el.id = 'vc-status';
    document.getElementById('vc-status-text').textContent = text;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    injectStyles();
    createDOM();
    // Preload voices for browser TTS fallback
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();
    console.log(`[VioletChat] ${CFG.name} initialized (${CFG.personality})`);
  }

  // Expose minimal API
  window.VioletChat = { open: () => { if (!isOpen) togglePanel(); }, close: () => { if (isOpen) togglePanel(); } };
})();
